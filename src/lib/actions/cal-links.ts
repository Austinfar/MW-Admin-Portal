'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type CalLinkType = 'consult' | 'monthly_coaching'

export interface CalUserLink {
    id: string
    user_id: string
    link_type: CalLinkType
    url: string
    display_name: string | null
    is_active: boolean
    event_type_id: number | null
    created_at: string
    updated_at: string
}

export interface CalUserLinkWithUser extends CalUserLink {
    user: {
        id: string
        name: string | null
        email: string
        job_title: string | null
    }
}

// ============================================
// Cal User Links CRUD
// ============================================

/**
 * Get all Cal.com links for a specific user
 */
export async function getCalLinksForUser(userId: string): Promise<CalUserLink[]> {
    const supabase = createAdminClient()

    const { data, error } = await supabase
        .from('cal_user_links')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('link_type')

    if (error) {
        console.error('[Cal Links] Error fetching user links:', error)
        return []
    }

    return data as CalUserLink[]
}

/**
 * Get all consult links for the setter dropdown
 * Returns all active consult links with user info
 */
export async function getAllConsultLinks(): Promise<CalUserLinkWithUser[]> {
    const supabase = createAdminClient()

    const { data, error } = await supabase
        .from('cal_user_links')
        .select(`
            *,
            user:users!cal_user_links_user_id_fkey (
                id,
                name,
                email,
                job_title
            )
        `)
        .eq('link_type', 'consult')
        .eq('is_active', true)

    if (error) {
        console.error('[Cal Links] Error fetching consult links:', error)
        return []
    }

    // Filter to only coaches, head_coaches, and closers
    const filteredData = (data || []).filter(link => {
        const jobTitle = link.user?.job_title
        return jobTitle === 'coach' || jobTitle === 'head_coach' || jobTitle === 'closer'
    })

    return filteredData as CalUserLinkWithUser[]
}

/**
 * Get the current user's Cal.com links
 */
export async function getMyCalLinks(): Promise<CalUserLink[]> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return []
    }

    return getCalLinksForUser(user.id)
}

/**
 * Get a specific link type for a user
 */
export async function getCalLinkByType(
    userId: string,
    linkType: CalLinkType
): Promise<CalUserLink | null> {
    const supabase = createAdminClient()

    const { data, error } = await supabase
        .from('cal_user_links')
        .select('*')
        .eq('user_id', userId)
        .eq('link_type', linkType)
        .eq('is_active', true)
        .single()

    if (error) {
        if (error.code !== 'PGRST116') { // Not found is expected
            console.error('[Cal Links] Error fetching link:', error)
        }
        return null
    }

    return data as CalUserLink
}

/**
 * Create or update a Cal.com link for a user
 */
export async function upsertCalLink(
    userId: string,
    linkType: CalLinkType,
    url: string,
    displayName?: string,
    eventTypeId?: number | null
): Promise<{ success: boolean; error?: string; link?: CalUserLink }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { success: false, error: 'Not authenticated' }
    }

    const admin = createAdminClient()

    // Verify requester has permission (is admin or the user themselves)
    const { data: requesterProfile } = await admin
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

    const isAdmin = requesterProfile?.role === 'admin' || requesterProfile?.role === 'super_admin'
    const isSelf = user.id === userId

    if (!isAdmin && !isSelf) {
        return { success: false, error: 'Unauthorized' }
    }

    // Determine display name
    const finalDisplayName = displayName ||
        (linkType === 'consult' ? 'Coaching Consult' : 'Monthly Coaching Call')

    // Upsert the link
    const { data, error } = await admin
        .from('cal_user_links')
        .upsert({
            user_id: userId,
            link_type: linkType,
            url: url.trim(),
            display_name: finalDisplayName,
            event_type_id: eventTypeId || null,
            is_active: true,
            updated_at: new Date().toISOString()
        }, {
            onConflict: 'user_id,link_type'
        })
        .select()
        .single()

    if (error) {
        console.error('[Cal Links] Error upserting link:', error)
        return { success: false, error: error.message }
    }

    revalidatePath('/profile')
    revalidatePath('/settings/team')
    revalidatePath('/sales-floor')

    return { success: true, link: data as CalUserLink }
}

/**
 * Delete a Cal.com link
 */
export async function deleteCalLink(linkId: string): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { success: false, error: 'Not authenticated' }
    }

    const admin = createAdminClient()

    // Get the link to check ownership
    const { data: link } = await admin
        .from('cal_user_links')
        .select('user_id')
        .eq('id', linkId)
        .single()

    if (!link) {
        return { success: false, error: 'Link not found' }
    }

    // Verify requester has permission
    const { data: requesterProfile } = await admin
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

    const isAdmin = requesterProfile?.role === 'admin' || requesterProfile?.role === 'super_admin'
    const isOwner = user.id === link.user_id

    if (!isAdmin && !isOwner) {
        return { success: false, error: 'Unauthorized' }
    }

    // Soft delete by setting is_active to false
    const { error } = await admin
        .from('cal_user_links')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', linkId)

    if (error) {
        console.error('[Cal Links] Error deleting link:', error)
        return { success: false, error: error.message }
    }

    revalidatePath('/profile')
    revalidatePath('/settings/team')
    revalidatePath('/sales-floor')

    return { success: true }
}

// ============================================
// Business Settings
// ============================================

/**
 * Get the global team calendar URL
 */
export async function getGlobalTeamCalendarUrl(): Promise<string | null> {
    const supabase = createAdminClient()

    const { data, error } = await supabase
        .from('business_settings')
        .select('value')
        .eq('key', 'global_team_calendar_url')
        .single()

    if (error) {
        console.error('[Cal Links] Error fetching global calendar URL:', error)
        return null
    }

    return data?.value || null
}

/**
 * Set the global team calendar URL (admin only)
 */
export async function setGlobalTeamCalendarUrl(
    url: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { success: false, error: 'Not authenticated' }
    }

    const admin = createAdminClient()

    // Verify requester is admin
    const { data: requesterProfile } = await admin
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

    if (requesterProfile?.role !== 'admin' && requesterProfile?.role !== 'super_admin') {
        return { success: false, error: 'Unauthorized: Admin access required' }
    }

    const { error } = await admin
        .from('business_settings')
        .update({
            value: url.trim(),
            updated_at: new Date().toISOString(),
            updated_by: user.id
        })
        .eq('key', 'global_team_calendar_url')

    if (error) {
        console.error('[Cal Links] Error updating global calendar URL:', error)
        return { success: false, error: error.message }
    }

    revalidatePath('/business')
    revalidatePath('/sales-floor')

    return { success: true }
}

/**
 * Get a business setting by key
 */
export async function getBusinessSetting(key: string): Promise<string | null> {
    const supabase = createAdminClient()

    const { data, error } = await supabase
        .from('business_settings')
        .select('value')
        .eq('key', key)
        .single()

    if (error) {
        if (error.code !== 'PGRST116') {
            console.error('[Cal Links] Error fetching business setting:', error)
        }
        return null
    }

    return data?.value || null
}

/**
 * Set a business setting (admin only)
 */
export async function setBusinessSetting(
    key: string,
    value: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { success: false, error: 'Not authenticated' }
    }

    const admin = createAdminClient()

    // Verify requester is admin
    const { data: requesterProfile } = await admin
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

    if (requesterProfile?.role !== 'admin' && requesterProfile?.role !== 'super_admin') {
        return { success: false, error: 'Unauthorized: Admin access required' }
    }

    const { error } = await admin
        .from('business_settings')
        .upsert({
            key,
            value: value.trim(),
            updated_at: new Date().toISOString(),
            updated_by: user.id
        }, {
            onConflict: 'key'
        })

    if (error) {
        console.error('[Cal Links] Error updating business setting:', error)
        return { success: false, error: error.message }
    }

    revalidatePath('/business')
    return { success: true }
}

// ============================================
// Helper Functions for War Room
// ============================================

/**
 * Get booking links data for the War Room
 * Returns different data based on user's job title
 */
export async function getWarRoomBookingLinks(): Promise<{
    globalCalendarUrl: string | null
    userLinks: CalUserLink[]
    allConsultLinks: CalUserLinkWithUser[]
    currentUserJobTitle: string | null
}> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return {
            globalCalendarUrl: null,
            userLinks: [],
            allConsultLinks: [],
            currentUserJobTitle: null
        }
    }

    const admin = createAdminClient()

    // Get current user's job title
    const { data: profile } = await admin
        .from('users')
        .select('job_title')
        .eq('id', user.id)
        .single()

    const jobTitle = profile?.job_title || null

    // Get global calendar URL
    const globalCalendarUrl = await getGlobalTeamCalendarUrl()

    // Get user's own links
    const userLinks = await getCalLinksForUser(user.id)

    // Get all consult links (for setters)
    const allConsultLinks = jobTitle === 'setter'
        ? await getAllConsultLinks()
        : []

    return {
        globalCalendarUrl,
        userLinks,
        allConsultLinks,
        currentUserJobTitle: jobTitle
    }
}
