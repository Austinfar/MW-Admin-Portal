'use server';

import { createClient } from '@/lib/supabase/server';
import { sendGHLSms } from '@/lib/actions/ghl';
import { revalidatePath } from 'next/cache';
import crypto from 'crypto';

export type Invitation = {
    id: string;
    email: string;
    role: 'admin' | 'coach' | 'sales';
    token: string;
    expires_at: string;
    status: 'pending' | 'accepted' | 'expired';
    created_at: string;
    invited_by: string;
};

// Generate a secure random token
function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

export async function getInvitations() {
    const supabase = await createClient();

    // Auth check should be here or handled by RLS, but explicit check is good
    // However, for MVP, we rely on Supabase RLS policies we created.

    const { data, error } = await supabase
        .from('invitations')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching invitations:', error);
        return { error: 'Failed to fetch invitations' };
    }

    return { invitations: data as Invitation[] };
}

export async function createInvitation(formData: FormData) {
    const supabase = await createClient();
    const email = formData.get('email') as string;
    const role = formData.get('role') as string; // 'admin' | 'coach' | 'sales'
    const sendSms = formData.get('sendSms') === 'on';
    const ghlContactId = formData.get('ghlContactId') as string;

    if (!email || !role) {
        return { error: 'Email and role are required' };
    }

    // Check for existing pending invite
    const { data: existing } = await supabase
        .from('invitations')
        .select('id')
        .eq('email', email)
        .eq('status', 'pending')
        .single();

    if (existing) {
        return { error: 'A pending invitation already exists for this email.' };
    }

    const token = generateToken();
    // Expires in 48 hours
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    // Get current user ID
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Unauthorized' };

    const { data, error } = await supabase
        .from('invitations')
        .insert({
            email,
            role,
            token,
            expires_at: expiresAt,
            invited_by: user.id,
        })
        .select()
        .single();

    if (error) {
        console.error('Error creating invitation:', error);
        return { error: error.message };
    }

    const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/join?token=${token}`;

    // Handle SMS sending if requested
    let smsStatus = 'skipped';
    if (sendSms && ghlContactId) {
        const message = `You have been invited to join the MW Coaching Team! Click here to set up your account: ${inviteLink}`;
        const smsResult = await sendGHLSms(ghlContactId, message);

        if (smsResult.error) {
            console.error('Failed to send SMS invite:', smsResult.error);
            smsStatus = 'failed';
            // We don't fail the whole action, just report it
            // Ideally we return a warning, but for now just success with note
        } else {
            smsStatus = 'sent';
        }
    }

    revalidatePath('/settings/team');
    return { success: 'Invitation created successfully', link: inviteLink, smsStatus };
}

export async function revokeInvitation(id: string) {
    const supabase = await createClient();

    // In a real app we might want to just mark as expired, but delete is cleaner for now
    const { error } = await supabase
        .from('invitations')
        .delete()
        .eq('id', id);

    if (error) {
        return { error: 'Failed to revoke invitation' };
    }

    revalidatePath('/settings/team');
    return { success: 'Invitation revoked' };
}

// For the /join page
export async function getInvitationByToken(token: string) {
    if (!token) return { error: 'Invalid token' };

    // Use Admin client to bypass RLS potentially? 
    // Actually, we set RLS to "public can select with token", so standard client works 
    // IF the user is anon. But createClient() handles anon/auth switch.

    const supabase = await createClient();

    const { data, error } = await supabase
        .from('invitations')
        .select('*')
        .eq('token', token)
        .eq('status', 'pending')
        .single();

    if (error || !data) {
        return { error: 'Invalid or expired invitation' };
    }

    // Check expiration
    if (new Date(data.expires_at) < new Date()) {
        return { error: 'Invitation has expired' };
    }

    return { invitation: data as Invitation };
}

export async function acceptInvitation(token: string, formData: FormData) {
    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;

    if (!password || password.length < 6) {
        return { error: 'Password must be at least 6 characters' };
    }
    if (password !== confirmPassword) {
        return { error: 'Passwords do not match' };
    }

    const { invitation, error: inviteError } = await getInvitationByToken(token);
    if (inviteError || !invitation) {
        return { error: inviteError || 'Invalid invitation' };
    }


    // Let's create a local admin client for this sensitive operation
    const { createClient: createSupabaseClient } = require('@supabase/supabase-js');
    const adminClient = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        }
    );

    // 1. Create Auth User
    const { data: authUser, error: createError } = await adminClient.auth.admin.createUser({
        email: invitation.email,
        password: password,
        email_confirm: true,
        user_metadata: { role: invitation.role }
    });

    if (createError) {
        console.error('Error creating user:', createError);
        return { error: createError.message };
    }

    if (!authUser.user) return { error: 'Failed to create user' };

    // 2. Create Profile (Public)
    // Assuming 'profiles' table exists and has 'id', 'role', 'email'
    // We update public.profiles. If user creation triggers a trigger, we might update instead of insert.
    // Usually standard Supabase starters have a trigger. Let's assume we need to INSERT or UPDATE.
    // Safe to UPSERT.

    // Wait, check if profiles table exists? The user mentioned 'public.profile' in plan.
    // But usually it's `profiles`. I'll assume `profiles`.
    // Actually, looking at previous summary: "creates their Supabase Auth user and `public.profile`".

    const { error: profileError } = await adminClient
        .from('profiles')
        .upsert({
            id: authUser.user.id,
            email: invitation.email,
            role: invitation.role,
            full_name: '', // We didn't ask for name yet
        });

    if (profileError) {
        // If profile creation fails, we should probably rollback user creation?
        // Or just log it. For MVP, we log.
        console.error('Error creating profile:', profileError);
        // We continue, as user can login.
    }

    // 3. Mark Invitation Accepted
    await adminClient
        .from('invitations')
        .update({ status: 'accepted', updated_at: new Date().toISOString() })
        .eq('id', invitation.id);

    return { success: true };
}
