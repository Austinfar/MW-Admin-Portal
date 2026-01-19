'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

const COOKIE_NAME = 'admin-restore-token'

export async function startImpersonation(userId: string) {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
        return { error: 'Not authenticated' }
    }

    // Verify current user is super_admin
    const adminClient = createAdminClient()
    const { data: adminUser, error: roleError } = await adminClient
        .from('users')
        .select('role, email')
        .eq('id', user.id)
        .single()

    if (roleError || !adminUser || adminUser.role !== 'super_admin') {
        return { error: 'Unauthorized: Only super admins can impersonate users' }
    }

    // Get the current session to store the refresh token
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.refresh_token) {
        return { error: 'No active session found' }
    }

    // Store the refresh token in a secure, http-only cookie
    const cookieStore = await cookies()
    cookieStore.set(COOKIE_NAME, session.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 // 24 hours
    })

    // Get target user email
    const { data: targetUser, error: targetError } = await adminClient
        .auth.admin.getUserById(userId)

    if (targetError || !targetUser?.user) {
        return { error: 'Target user not found' }
    }

    // Generate magic link for target user
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
        type: 'magiclink',
        email: targetUser.user.email!,
        options: {
            redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback?next=/dashboard`
        }
    })

    if (linkError || !linkData.properties?.action_link) {
        console.error('Failed to generate impersonation link:', linkError)
        return { error: 'Failed to generate access link' }
    }

    // Return the redirect URL
    return { success: true, redirectUrl: linkData.properties.action_link }
}

export async function stopImpersonation() {
    console.log('[stopImpersonation] Starting session restore...')
    const cookieStore = await cookies()
    const refreshToken = cookieStore.get(COOKIE_NAME)?.value

    if (!refreshToken) {
        console.error('[stopImpersonation] No restore token found in cookie')
        return { error: 'No restore session found' }
    }
    console.log('[stopImpersonation] Found restore token')

    const supabase = await createClient()

    // Sign out current impersonated user
    await supabase.auth.signOut()

    // Refresh the admin session using the stored token
    const { data, error } = await supabase.auth.refreshSession({
        refresh_token: refreshToken
    })

    if (error || !data.session) {
        console.error('[stopImpersonation] Failed to restore admin session:', error)
        // If restore fails, we'll need to redirect to login
        cookieStore.delete(COOKIE_NAME)
        return { error: 'Failed to restore session. Please log in again.' }
    }

    // Clean up the cookie
    cookieStore.delete(COOKIE_NAME)

    revalidatePath('/')
    return { success: true }
}

export async function isImpersonating() {
    const cookieStore = await cookies()
    return !!cookieStore.get(COOKIE_NAME)
}

export async function searchUsers(query: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Not authenticated' }

    // Check if requester is super_admin
    const adminClient = createAdminClient()
    const { data: requester } = await adminClient
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

    if (requester?.role !== 'super_admin') {
        return { error: 'Unauthorized', users: [] }
    }

    let queryBuilder = adminClient
        .from('users')
        .select('id, email, first_name, last_name, role, avatar_url')
        .neq('id', user.id) // Exclude current user
        .order('created_at', { ascending: false })
        .limit(20)

    if (query) {
        queryBuilder = queryBuilder.or(`email.ilike.%${query}%,first_name.ilike.%${query}%,last_name.ilike.%${query}%`)
    }

    const { data: users, error } = await queryBuilder

    if (error) {
        console.error('Error searching users:', error)
        return { error: 'Failed to search users', users: [] }
    }

    return { users }
}
