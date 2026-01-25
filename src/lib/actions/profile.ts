
'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { UserPermissions } from '@/lib/auth-utils';

export interface UserProfile {
    id: string;
    email: string;
    name: string;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    avatar_url: string | null;
    role: 'super_admin' | 'admin' | 'user';
    commission_rate: number | null;
    is_active: boolean;
    created_at: string;
    permissions?: UserPermissions;
}

export interface User {
    id: string
    name: string | null
    email: string
    role: 'super_admin' | 'admin' | 'user'
    job_title: 'coach' | 'head_coach' | 'closer' | 'admin_staff' | 'operations' | null
    permissions: UserPermissions
    commission_config?: Record<string, number>
    is_active: boolean
    created_at: string
    avatar_url: string | null
    slack_user_id: string | null
    bio?: string
    specialties?: string[]
    public_role?: string
    display_on_female_landing?: boolean
    display_on_male_landing?: boolean
    display_order?: number
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
 * Upload avatar image for a user (uses admin client to bypass storage RLS)
 */
export async function uploadAvatarForUser(userId: string, base64Data: string): Promise<{ url?: string; error?: string }> {
    try {
        const admin = createAdminClient();

        // Convert base64 to buffer
        const base64Clean = base64Data.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Clean, 'base64');

        const fileName = `${userId}-${Date.now()}.jpg`;
        const filePath = `avatars/${fileName}`;

        // Upload using admin client (bypasses RLS)
        const { error: uploadError } = await admin.storage
            .from('avatars')
            .upload(filePath, buffer, {
                contentType: 'image/jpeg',
                upsert: true
            });

        if (uploadError) {
            console.error('Avatar upload error:', uploadError);
            return { error: uploadError.message };
        }

        // Get public URL
        const { data: { publicUrl } } = admin.storage
            .from('avatars')
            .getPublicUrl(filePath);

        return { url: publicUrl };
    } catch (error: any) {
        console.error('Avatar upload failed:', error);
        return { error: error?.message || 'Upload failed' };
    }
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
 * Update user's role (super_admin only for role changes)
 * CRITICAL: super_admin is locked to austin@mwfitnesscoaching.com ONLY
 */
const SUPER_ADMIN_EMAIL = 'austin@mwfitnesscoaching.com';

export async function updateUserRole(userId: string, role: 'super_admin' | 'admin' | 'user') {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { error: 'Not authenticated' };
    }

    const adminClient = createAdminClient();

    // Get current user's role and email
    const { data: currentUser } = await adminClient
        .from('users')
        .select('role, email')
        .eq('id', user.id)
        .single();

    // Only super_admin can change roles
    if (currentUser?.role !== 'super_admin') {
        return { error: 'Only Super Admin can change user roles' };
    }

    // Get target user's email to validate super_admin assignment
    const { data: targetUser } = await adminClient
        .from('users')
        .select('email')
        .eq('id', userId)
        .single();

    // CRITICAL: super_admin can ONLY be assigned to austin@mwfitnesscoaching.com
    if (role === 'super_admin' && targetUser?.email?.toLowerCase() !== SUPER_ADMIN_EMAIL.toLowerCase()) {
        return { error: 'Super Admin role is restricted to austin@mwfitnesscoaching.com only' };
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
    revalidatePath('/settings/team');
    return { success: true };
}

/**
 * Get all users (for admin user management) - Protected
 */
export async function getAllUsers() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Not authenticated' }
    }

    const admin = createAdminClient()

    // Verify requesting user is admin
    const { data: requesterProfile } = await admin
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

    if (requesterProfile?.role !== 'admin' && requesterProfile?.role !== 'super_admin') {
        return { error: 'Unauthorized: Admin access required' }
    }

    const { data: users, error } = await admin
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })

    if (error) {
        return { error: error.message }
    }

    return { users: users as User[] }
}

/**
 * Update user permissions (admin only)
 */
export async function updateUserPermissions(userId: string, permissions: UserPermissions) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Not authenticated' }
    }

    const admin = createAdminClient()

    // Verify requesting user is admin
    const { data: requesterProfile } = await admin
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

    if (requesterProfile?.role !== 'admin' && requesterProfile?.role !== 'super_admin') {
        return { error: 'Unauthorized' }
    }

    const { error } = await admin
        .from('users')
        .update({
            permissions,
            updated_at: new Date().toISOString()
        })
        .eq('id', userId)

    if (error) {
        return { error: error.message }
    }

    // Revalidate paths that depend on permissions
    revalidatePath('/')

    return { success: true }
}

/**
 * Update user job title (admin only)
 */
export async function updateUserJobTitle(userId: string, jobTitle: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Not authenticated' }
    }

    const admin = createAdminClient()

    // Verify requesting user is admin
    const { data: requesterProfile } = await admin
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

    if (requesterProfile?.role !== 'admin' && requesterProfile?.role !== 'super_admin') {
        return { error: 'Unauthorized' }
    }

    const { error } = await admin
        .from('users')
        .update({
            job_title: jobTitle,
            updated_at: new Date().toISOString()
        })
        .eq('id', userId)

    if (error) {
        return { error: error.message }
    }

    revalidatePath('/settings/team')
    return { success: true }
}

export async function updateUserCommissionConfig(userId: string, config: Record<string, number>) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Not authenticated' }

    const admin = createAdminClient()
    const { data: requesterProfile } = await admin
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

    if (requesterProfile?.role !== 'admin' && requesterProfile?.role !== 'super_admin') {
        return { error: 'Unauthorized' }
    }

    const { error } = await admin
        .from('users')
        .update({
            commission_config: config,
            updated_at: new Date().toISOString()
        })
        .eq('id', userId)

    if (error) return { error: error.message }

    revalidatePath('/settings/team')
    return { success: true }
}

/**
 * Create a new user (super admin only)
 * Uses Supabase Admin API to create auth user and profile in one go
 */
export async function createUser(data: {
    email: string
    password: string
    name: string
    role: 'admin' | 'user'
    jobTitle: string
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Not authenticated' }

    const admin = createAdminClient()

    // Verify requester is super_admin
    const { data: requesterProfile } = await admin
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

    if (requesterProfile?.role !== 'super_admin') {
        return { error: 'Unauthorized: Super Admin access required' }
    }

    try {
        // 1. Create auth user via Admin API
        const { data: authData, error: authError } = await admin.auth.admin.createUser({
            email: data.email,
            password: data.password,
            email_confirm: true, // Auto-confirm email
        })

        if (authError || !authData.user) {
            console.error('Auth user creation failed:', authError)
            return { error: authError?.message || 'Failed to create user' }
        }

        // 2. Create user profile in users table
        const { error: profileError } = await admin
            .from('users')
            .insert({
                id: authData.user.id,
                email: data.email,
                name: data.name,
                role: data.role,
                job_title: data.jobTitle,
                is_active: true,
                permissions: {
                    dashboard: true,
                    clients: false,
                    leads: false,
                    commissions: false,
                    sales: false,
                    onboarding: false,
                    payment_links: false,
                    settings: false,
                    business: false,
                    sales_floor: false,
                },
            })

        if (profileError) {
            console.error('Profile creation failed:', profileError)
            // Try to clean up auth user
            await admin.auth.admin.deleteUser(authData.user.id)
            return { error: profileError.message }
        }

        revalidatePath('/settings/team')
        return { success: true, userId: authData.user.id }
    } catch (error: any) {
        console.error('User creation error:', error)
        return { error: error?.message || 'Failed to create user' }
    }
}

/**
 * Update user details including name, email, and password (super admin only)
 */
export async function updateUserDetails(userId: string, data: {
    name?: string
    email?: string
    password?: string
    avatar_url?: string
    slack_user_id?: string | null
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Not authenticated' }

    const admin = createAdminClient()

    // Verify requester is super_admin
    const { data: requesterProfile } = await admin
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

    if (requesterProfile?.role !== 'super_admin') {
        return { error: 'Unauthorized: Super Admin access required' }
    }

    try {
        // 1. Update auth user if email or password changed
        if (data.email || data.password) {
            const authUpdate: { email?: string; password?: string } = {}
            if (data.email) authUpdate.email = data.email
            if (data.password) authUpdate.password = data.password

            const { error: authError } = await admin.auth.admin.updateUserById(userId, authUpdate)
            if (authError) {
                console.error('Auth update failed:', authError)
                return { error: authError.message }
            }
        }

        // 2. Update users table
        const profileUpdate: Record<string, any> = { updated_at: new Date().toISOString() }
        if (data.name) profileUpdate.name = data.name
        if (data.email) profileUpdate.email = data.email
        if (data.avatar_url) profileUpdate.avatar_url = data.avatar_url
        if (data.slack_user_id !== undefined) profileUpdate.slack_user_id = data.slack_user_id

        const { error: profileError } = await admin
            .from('users')
            .update(profileUpdate)
            .eq('id', userId)

        if (profileError) {
            return { error: profileError.message }
        }

        revalidatePath('/settings/team')
        revalidatePath('/profile')
        return { success: true }
    } catch (error: any) {
        console.error('User update error:', error)
        return { error: error?.message || 'Failed to update user' }
    }
}

/**
 * Deactivate a user (super admin only)
 * - Sets is_active = false so they don't appear in active lists
 * - Deletes auth user so they can't log in
 * - Keeps all commission records, sales records, and history intact
 */
export async function deleteUser(userId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Not authenticated' }

    const admin = createAdminClient()

    // Verify requester is super_admin
    const { data: requesterProfile } = await admin
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

    if (requesterProfile?.role !== 'super_admin') {
        return { error: 'Unauthorized: Super Admin access required' }
    }

    // Prevent deleting self
    if (userId === user.id) {
        return { error: 'Cannot delete your own account' }
    }

    // Get the user being deleted to prevent super_admin deletion
    const { data: targetUser } = await admin
        .from('users')
        .select('role, email')
        .eq('id', userId)
        .single()

    if (targetUser?.role === 'super_admin') {
        return { error: 'Cannot delete Super Admin accounts' }
    }

    try {
        // 1. Soft delete - mark as inactive
        // This keeps all commission records, sales records, and history intact
        const { error: profileError } = await admin
            .from('users')
            .update({
                is_active: false,
                updated_at: new Date().toISOString()
            })
            .eq('id', userId)

        if (profileError) {
            console.error('Profile deactivation failed:', profileError)
            return { error: `Failed to deactivate user: ${profileError.message}` }
        }

        // 2. Delete from auth so they can't log in
        // Note: This may fail if there's FK constraint, but profile is already deactivated
        const { error: authError } = await admin.auth.admin.deleteUser(userId)
        if (authError) {
            console.error('Auth deletion failed (user already deactivated):', authError)
            // Continue - the user is already deactivated and can't access the system
        }

        revalidatePath('/settings/team')
        return { success: true }
    } catch (error: any) {
        console.error('User deactivation error:', error)
        return { error: error?.message || 'Failed to deactivate user' }
    }
}

/**
 * Reactivate a deactivated user (super admin only)
 */
export async function reactivateUser(userId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Not authenticated' }

    const admin = createAdminClient()

    // Verify requester is super_admin
    const { data: requesterProfile } = await admin
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

    if (requesterProfile?.role !== 'super_admin') {
        return { error: 'Unauthorized: Super Admin access required' }
    }

    try {
        const { error } = await admin
            .from('users')
            .update({
                is_active: true,
                updated_at: new Date().toISOString()
            })
            .eq('id', userId)

        if (error) {
            return { error: `Failed to reactivate user: ${error.message}` }
        }

        revalidatePath('/settings/team')
        return { success: true }
    } catch (error: any) {
        console.error('User reactivation error:', error)
        return { error: error?.message || 'Failed to reactivate user' }
    }
}

/**
 * Update coach profile details (Admin/Super Admin only)
 */
export async function updateCoachProfile(userId: string, data: {
    bio?: string
    specialties?: string[]
    public_role?: string
    display_on_female_landing?: boolean
    display_on_male_landing?: boolean
    avatar_url?: string
    display_order?: number
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Not authenticated' }

    const admin = createAdminClient()

    // Verify requesting user is admin
    const { data: requesterProfile } = await admin
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

    if (requesterProfile?.role !== 'admin' && requesterProfile?.role !== 'super_admin') {
        return { error: 'Unauthorized: Admin access required' }
    }

    const { error } = await admin
        .from('users')
        .update({
            ...data,
            updated_at: new Date().toISOString()
        })
        .eq('id', userId)

    if (error) {
        return { error: error.message }
    }

    revalidatePath('/settings/team')
    return { success: true }
}
