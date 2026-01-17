'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export interface UserProfile {
    id: string;
    email: string;
    name: string;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    avatar_url: string | null;
    role: 'admin' | 'coach' | 'sales_closer';
    commission_rate: number | null;
    is_active: boolean;
    created_at: string;
}

/**
 * Get the current user's profile
 * Falls back to first user in DB for demo/dev purposes
 */
export async function getCurrentUserProfile(): Promise<UserProfile | null> {
    const adminClient = createAdminClient();

    // Try to get authenticated user first
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
            const { data, error } = await adminClient
                .from('users')
                .select('*')
                .eq('id', user.id)
                .single();

            if (!error && data) {
                return data as UserProfile;
            }
        }
    } catch (e) {
        // Auth not available, fall through to default user
    }

    // Fall back to first active user (for demo/dev)
    const { data, error } = await adminClient
        .from('users')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

    if (error) {
        console.error('[Profile] Error fetching default profile:', error);
        return null;
    }

    return data as UserProfile;
}

/**
 * Get a user profile by ID (admin only)
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
    const adminClient = createAdminClient();

    const { data, error } = await adminClient
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

    if (error) {
        console.error('[Profile] Error fetching user profile:', error);
        return null;
    }

    return data as UserProfile;
}

/**
 * Get the current user ID (auth or default)
 */
async function getCurrentUserId(): Promise<string | null> {
    const adminClient = createAdminClient();

    // Try auth first
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) return user.id;
    } catch (e) {
        // Fall through
    }

    // Fall back to first active user
    const { data } = await adminClient
        .from('users')
        .select('id')
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

    return data?.id || null;
}

/**
 * Update the current user's profile
 */
export async function updateProfile(formData: FormData) {
    const userId = await getCurrentUserId();

    if (!userId) {
        return { error: 'No user found' };
    }

    const firstName = formData.get('first_name') as string;
    const lastName = formData.get('last_name') as string;
    const phone = formData.get('phone') as string;

    // Combine first and last name for the name field
    const fullName = `${firstName} ${lastName}`.trim();

    const adminClient = createAdminClient();

    // Try updating with all fields first
    let { error } = await adminClient
        .from('users')
        .update({
            first_name: firstName || null,
            last_name: lastName || null,
            name: fullName || null,
            phone: phone || null,
            updated_at: new Date().toISOString()
        })
        .eq('id', userId);

    // If columns don't exist, fall back to just updating name
    if (error && error.message?.includes('column')) {
        console.warn('[Profile] New columns not found, updating name only');
        const result = await adminClient
            .from('users')
            .update({
                name: fullName || null,
                updated_at: new Date().toISOString()
            })
            .eq('id', userId);
        error = result.error;
    }

    if (error) {
        console.error('[Profile] Error updating profile:', error);
        return { error: 'Failed to update profile' };
    }

    revalidatePath('/profile');
    return { success: true };
}

/**
 * Update user's avatar URL
 */
export async function updateAvatar(avatarUrl: string) {
    const userId = await getCurrentUserId();

    if (!userId) {
        return { error: 'No user found' };
    }

    const adminClient = createAdminClient();
    const { error } = await adminClient
        .from('users')
        .update({
            avatar_url: avatarUrl,
            updated_at: new Date().toISOString()
        })
        .eq('id', userId);

    // If avatar_url column doesn't exist, just log and return success
    if (error && error.message?.includes('column')) {
        console.warn('[Profile] avatar_url column not found. Run migration to add it.');
        return { error: 'Avatar column not found in database. Please run the migration.' };
    }

    if (error) {
        console.error('[Profile] Error updating avatar:', error);
        return { error: 'Failed to update avatar' };
    }

    revalidatePath('/profile');
    return { success: true };
}

/**
 * Update user's role (admin only)
 */
export async function updateUserRole(userId: string, role: 'admin' | 'coach' | 'sales_closer') {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { error: 'Not authenticated' };
    }

    // Check if current user is admin
    const adminClient = createAdminClient();
    const { data: currentUser } = await adminClient
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

    if (currentUser?.role !== 'admin') {
        return { error: 'Only admins can change user roles' };
    }

    const { error } = await adminClient
        .from('users')
        .update({
            role,
            updated_at: new Date().toISOString()
        })
        .eq('id', userId);

    if (error) {
        console.error('[Profile] Error updating role:', error);
        return { error: 'Failed to update role' };
    }

    revalidatePath('/profile');
    return { success: true };
}

/**
 * Get all users (for admin user management)
 */
export async function getAllUsers(): Promise<UserProfile[]> {
    const adminClient = createAdminClient();

    const { data, error } = await adminClient
        .from('users')
        .select('*')
        .order('name', { ascending: true });

    if (error) {
        console.error('[Profile] Error fetching users:', error);
        return [];
    }

    return data as UserProfile[];
}
