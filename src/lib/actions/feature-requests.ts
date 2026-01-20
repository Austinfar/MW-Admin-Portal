'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type {
    FeatureRequest,
    FeatureComment,
    FeatureTag,
    Milestone,
    Announcement,
    FeatureNotification,
    FeatureStatusHistory,
    CreateRequestInput,
    UpdateRequestInput,
    RequestFilters,
    RequestSortOptions,
    PaginationOptions,
    RequestListResult,
    RoadmapStats,
    RequestStatus,
} from '@/types/roadmap'

// ===========================================
// HELPER FUNCTIONS
// ===========================================

async function getCurrentUserId(): Promise<string | null> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    return user?.id || null
}

async function isSuperAdmin(): Promise<boolean> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false

    const admin = createAdminClient()
    const { data } = await admin
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

    return data?.role === 'super_admin'
}

// ===========================================
// FEATURE REQUESTS
// ===========================================

export async function getFeatureRequests(
    filters?: RequestFilters,
    sort?: RequestSortOptions,
    pagination?: PaginationOptions
): Promise<RequestListResult> {
    const supabase = await createClient()
    const userId = await getCurrentUserId()

    const page = pagination?.page || 1
    const limit = pagination?.limit || 20
    const offset = (page - 1) * limit

    let query = supabase
        .from('feature_requests')
        .select(`
            *,
            submitter:users!submitter_id(id, name, avatar_url),
            assignee:users!assigned_to(id, name, avatar_url),
            milestone:milestones(id, name, target_date, is_completed)
        `, { count: 'exact' })

    // Apply filters
    if (filters?.is_archived !== undefined) {
        query = query.eq('is_archived', filters.is_archived)
    } else {
        query = query.eq('is_archived', false)
    }

    if (filters?.status) {
        if (Array.isArray(filters.status)) {
            query = query.in('status', filters.status)
        } else {
            query = query.eq('status', filters.status)
        }
    }

    if (filters?.category) {
        if (Array.isArray(filters.category)) {
            query = query.in('category', filters.category)
        } else {
            query = query.eq('category', filters.category)
        }
    }

    if (filters?.type) {
        if (Array.isArray(filters.type)) {
            query = query.in('type', filters.type)
        } else {
            query = query.eq('type', filters.type)
        }
    }

    if (filters?.submitter_id) {
        query = query.eq('submitter_id', filters.submitter_id)
    }

    if (filters?.assigned_to) {
        query = query.eq('assigned_to', filters.assigned_to)
    }

    if (filters?.milestone_id) {
        query = query.eq('milestone_id', filters.milestone_id)
    }

    if (filters?.search) {
        query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`)
    }

    // Apply sorting
    const sortField = sort?.field || 'priority_score'
    const sortDirection = sort?.direction || 'desc'
    query = query.order(sortField, { ascending: sortDirection === 'asc' })

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data: requests, count, error } = await query

    if (error) {
        console.error('Error fetching requests:', error)
        return { data: [], total: 0, page, limit, totalPages: 0 }
    }

    // Get user's votes and watches
    let userVotes: string[] = []
    let userWatches: string[] = []

    if (userId && requests && requests.length > 0) {
        const requestIds = requests.map(r => r.id)

        const [votesResult, watchesResult] = await Promise.all([
            supabase
                .from('feature_votes')
                .select('request_id')
                .eq('user_id', userId)
                .in('request_id', requestIds),
            supabase
                .from('feature_watchers')
                .select('request_id')
                .eq('user_id', userId)
                .in('request_id', requestIds)
        ])

        userVotes = votesResult.data?.map(v => v.request_id) || []
        userWatches = watchesResult.data?.map(w => w.request_id) || []
    }

    const enrichedRequests: FeatureRequest[] = (requests || []).map((r: any) => ({
        ...r,
        has_voted: userVotes.includes(r.id),
        is_watching: userWatches.includes(r.id),
    }))

    return {
        data: enrichedRequests,
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
    }
}

export async function getFeatureRequest(id: string): Promise<FeatureRequest | null> {
    const supabase = await createClient()
    const userId = await getCurrentUserId()

    const { data: request, error } = await supabase
        .from('feature_requests')
        .select(`
            *,
            submitter:users!submitter_id(id, name, avatar_url),
            assignee:users!assigned_to(id, name, avatar_url),
            milestone:milestones(id, name, target_date, is_completed)
        `)
        .eq('id', id)
        .single()

    if (error || !request) {
        console.error('Error fetching request:', error)
        return null
    }

    // Check if user has voted/is watching
    let has_voted = false
    let is_watching = false

    if (userId) {
        const [voteResult, watchResult] = await Promise.all([
            supabase
                .from('feature_votes')
                .select('id')
                .eq('request_id', id)
                .eq('user_id', userId)
                .single(),
            supabase
                .from('feature_watchers')
                .select('id')
                .eq('request_id', id)
                .eq('user_id', userId)
                .single()
        ])

        has_voted = !!voteResult.data
        is_watching = !!watchResult.data
    }

    return { ...request, has_voted, is_watching } as FeatureRequest
}

export async function createFeatureRequest(input: CreateRequestInput): Promise<{ data?: FeatureRequest; error?: string }> {
    const supabase = await createClient()
    const userId = await getCurrentUserId()

    if (!userId) {
        return { error: 'Not authenticated' }
    }

    const { data, error } = await supabase
        .from('feature_requests')
        .insert({
            title: input.title,
            description: input.description,
            category: input.category,
            type: input.type,
            priority: input.priority,
            submitter_id: userId,
            screenshot_urls: input.screenshot_urls || [],
        })
        .select()
        .single()

    if (error) {
        console.error('Error creating request:', error)
        return { error: error.message }
    }

    // Auto-watch the request for the submitter
    await supabase.from('feature_watchers').insert({
        request_id: data.id,
        user_id: userId,
    })

    revalidatePath('/roadmap')
    return { data: data as FeatureRequest }
}

export async function updateFeatureRequest(input: UpdateRequestInput): Promise<{ data?: FeatureRequest; error?: string }> {
    const isAdmin = await isSuperAdmin()
    if (!isAdmin) {
        return { error: 'Only super admins can update requests' }
    }

    const supabase = await createClient()

    const updateData: any = {}
    if (input.status !== undefined) updateData.status = input.status
    if (input.assigned_to !== undefined) updateData.assigned_to = input.assigned_to
    if (input.milestone_id !== undefined) updateData.milestone_id = input.milestone_id
    if (input.target_quarter !== undefined) updateData.target_quarter = input.target_quarter
    if (input.effort_estimate !== undefined) updateData.effort_estimate = input.effort_estimate
    if (input.tags !== undefined) updateData.tags = input.tags
    if (input.admin_notes !== undefined) updateData.admin_notes = input.admin_notes
    if (input.rejection_reason !== undefined) updateData.rejection_reason = input.rejection_reason
    if (input.release_notes !== undefined) updateData.release_notes = input.release_notes
    if (input.related_request_ids !== undefined) updateData.related_request_ids = input.related_request_ids
    if (input.external_links !== undefined) updateData.external_links = input.external_links

    const { data, error } = await supabase
        .from('feature_requests')
        .update(updateData)
        .eq('id', input.id)
        .select()
        .single()

    if (error) {
        console.error('Error updating request:', error)
        return { error: error.message }
    }

    // Create notifications for watchers if status changed
    if (input.status) {
        await notifyWatchers(input.id, 'status_change', `Status changed to ${input.status}`)
    }

    revalidatePath('/roadmap')
    return { data: data as FeatureRequest }
}

export async function archiveFeatureRequest(id: string): Promise<{ success: boolean; error?: string }> {
    const isAdmin = await isSuperAdmin()
    if (!isAdmin) {
        return { success: false, error: 'Only super admins can archive requests' }
    }

    const supabase = await createClient()
    const { error } = await supabase
        .from('feature_requests')
        .update({ is_archived: true })
        .eq('id', id)

    if (error) {
        return { success: false, error: error.message }
    }

    revalidatePath('/roadmap')
    return { success: true }
}

export async function deleteFeatureRequest(id: string): Promise<{ success: boolean; error?: string }> {
    const isAdmin = await isSuperAdmin()
    if (!isAdmin) {
        return { success: false, error: 'Only super admins can delete requests' }
    }

    const admin = createAdminClient()

    // Delete related records first (comments, votes, watchers, etc.)
    await Promise.all([
        admin.from('feature_comments').delete().eq('request_id', id),
        admin.from('feature_votes').delete().eq('request_id', id),
        admin.from('feature_watchers').delete().eq('request_id', id),
        admin.from('feature_status_history').delete().eq('request_id', id),
        admin.from('feature_request_tags').delete().eq('request_id', id),
    ])

    // Delete the request itself
    const { error } = await admin
        .from('feature_requests')
        .delete()
        .eq('id', id)

    if (error) {
        return { success: false, error: error.message }
    }

    revalidatePath('/roadmap')
    return { success: true }
}

// ===========================================
// VOTING
// ===========================================

export async function toggleVote(requestId: string): Promise<{ voted: boolean; voteCount: number; error?: string }> {
    const supabase = await createClient()
    const userId = await getCurrentUserId()

    if (!userId) {
        return { voted: false, voteCount: 0, error: 'Not authenticated' }
    }

    // Check if already voted
    const { data: existingVote } = await supabase
        .from('feature_votes')
        .select('id')
        .eq('request_id', requestId)
        .eq('user_id', userId)
        .single()

    if (existingVote) {
        // Remove vote
        await supabase
            .from('feature_votes')
            .delete()
            .eq('id', existingVote.id)
    } else {
        // Add vote
        await supabase
            .from('feature_votes')
            .insert({ request_id: requestId, user_id: userId })
    }

    // Get updated count
    const { data: request } = await supabase
        .from('feature_requests')
        .select('vote_count')
        .eq('id', requestId)
        .single()

    revalidatePath('/roadmap')
    return { voted: !existingVote, voteCount: request?.vote_count || 0 }
}

// ===========================================
// WATCHING
// ===========================================

export async function toggleWatch(requestId: string): Promise<{ watching: boolean; error?: string }> {
    const supabase = await createClient()
    const userId = await getCurrentUserId()

    if (!userId) {
        return { watching: false, error: 'Not authenticated' }
    }

    const { data: existingWatch } = await supabase
        .from('feature_watchers')
        .select('id')
        .eq('request_id', requestId)
        .eq('user_id', userId)
        .single()

    if (existingWatch) {
        await supabase
            .from('feature_watchers')
            .delete()
            .eq('id', existingWatch.id)
    } else {
        await supabase
            .from('feature_watchers')
            .insert({ request_id: requestId, user_id: userId })
    }

    return { watching: !existingWatch }
}

// ===========================================
// COMMENTS
// ===========================================

export async function getComments(requestId: string): Promise<FeatureComment[]> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('feature_comments')
        .select(`
            *,
            user:users(id, name, avatar_url)
        `)
        .eq('request_id', requestId)
        .order('created_at', { ascending: true })

    if (error) {
        console.error('Error fetching comments:', error)
        return []
    }

    return data as FeatureComment[]
}

export async function addComment(
    requestId: string,
    content: string,
    mentions: string[] = []
): Promise<{ data?: FeatureComment; error?: string }> {
    const supabase = await createClient()
    const userId = await getCurrentUserId()

    if (!userId) {
        return { error: 'Not authenticated' }
    }

    // Check if user is admin
    const isAdmin = await isSuperAdmin()

    const { data, error } = await supabase
        .from('feature_comments')
        .insert({
            request_id: requestId,
            user_id: userId,
            content,
            is_admin_response: isAdmin,
        })
        .select(`
            *,
            user:users(id, name, avatar_url)
        `)
        .single()

    if (error) {
        console.error('Error adding comment:', error)
        return { error: error.message }
    }

    // Notify watchers
    await notifyWatchers(requestId, 'new_comment', 'New comment added')

    // Notify mentioned users
    for (const mentionedId of mentions) {
        await createNotification(mentionedId, requestId, 'mention', 'You were mentioned in a comment')
    }

    revalidatePath('/roadmap')
    return { data: data as FeatureComment }
}

export async function toggleCommentReaction(
    commentId: string,
    emoji: string
): Promise<{ success: boolean; reactions: Record<string, string[]>; error?: string }> {
    const supabase = await createClient()
    const userId = await getCurrentUserId()

    if (!userId) {
        return { success: false, reactions: {}, error: 'Not authenticated' }
    }

    // Get current reactions
    const { data: comment } = await supabase
        .from('feature_comments')
        .select('reactions')
        .eq('id', commentId)
        .single()

    if (!comment) {
        return { success: false, reactions: {}, error: 'Comment not found' }
    }

    const reactions = (comment.reactions as Record<string, string[]>) || {}
    const emojiReactions = reactions[emoji] || []

    if (emojiReactions.includes(userId)) {
        // Remove reaction
        reactions[emoji] = emojiReactions.filter(id => id !== userId)
        if (reactions[emoji].length === 0) {
            delete reactions[emoji]
        }
    } else {
        // Add reaction
        reactions[emoji] = [...emojiReactions, userId]
    }

    const { error } = await supabase
        .from('feature_comments')
        .update({ reactions })
        .eq('id', commentId)

    if (error) {
        return { success: false, reactions: {}, error: error.message }
    }

    return { success: true, reactions }
}

// ===========================================
// TAGS
// ===========================================

export async function getTags(): Promise<FeatureTag[]> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('feature_tags')
        .select('*')
        .order('name')

    if (error) {
        console.error('Error fetching tags:', error)
        return []
    }

    return data as FeatureTag[]
}

export async function createTag(name: string, color: string): Promise<{ data?: FeatureTag; error?: string }> {
    const isAdmin = await isSuperAdmin()
    if (!isAdmin) {
        return { error: 'Only super admins can create tags' }
    }

    const supabase = await createClient()
    const userId = await getCurrentUserId()

    const { data, error } = await supabase
        .from('feature_tags')
        .insert({ name, color, created_by: userId })
        .select()
        .single()

    if (error) {
        return { error: error.message }
    }

    return { data: data as FeatureTag }
}

export async function deleteTag(id: string): Promise<{ success: boolean; error?: string }> {
    const isAdmin = await isSuperAdmin()
    if (!isAdmin) {
        return { success: false, error: 'Only super admins can delete tags' }
    }

    const supabase = await createClient()
    const { error } = await supabase
        .from('feature_tags')
        .delete()
        .eq('id', id)

    return { success: !error, error: error?.message }
}

// ===========================================
// MILESTONES
// ===========================================

export async function getMilestones(): Promise<Milestone[]> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('milestones')
        .select('*')
        .order('target_date', { ascending: true, nullsFirst: false })

    if (error) {
        console.error('Error fetching milestones:', error)
        return []
    }

    return data as Milestone[]
}

export async function createMilestone(
    name: string,
    description?: string,
    targetDate?: string
): Promise<{ data?: Milestone; error?: string }> {
    const isAdmin = await isSuperAdmin()
    if (!isAdmin) {
        return { error: 'Only super admins can create milestones' }
    }

    const supabase = await createClient()
    const userId = await getCurrentUserId()

    const { data, error } = await supabase
        .from('milestones')
        .insert({
            name,
            description,
            target_date: targetDate,
            created_by: userId,
        })
        .select()
        .single()

    if (error) {
        return { error: error.message }
    }

    return { data: data as Milestone }
}

export async function updateMilestone(
    id: string,
    updates: Partial<Omit<Milestone, 'id' | 'created_at' | 'updated_at'>>
): Promise<{ success: boolean; error?: string }> {
    const isAdmin = await isSuperAdmin()
    if (!isAdmin) {
        return { success: false, error: 'Only super admins can update milestones' }
    }

    const supabase = await createClient()
    const { error } = await supabase
        .from('milestones')
        .update(updates)
        .eq('id', id)

    return { success: !error, error: error?.message }
}

// ===========================================
// ANNOUNCEMENTS
// ===========================================

export async function getActiveAnnouncements(): Promise<Announcement[]> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('announcements')
        .select(`
            *,
            creator:users(id, name, avatar_url)
        `)
        .eq('is_active', true)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching announcements:', error)
        return []
    }

    return data as Announcement[]
}

export async function createAnnouncement(
    title: string,
    content: string,
    expiresAt?: string
): Promise<{ data?: Announcement; error?: string }> {
    const isAdmin = await isSuperAdmin()
    if (!isAdmin) {
        return { error: 'Only super admins can create announcements' }
    }

    const supabase = await createClient()
    const userId = await getCurrentUserId()

    const { data, error } = await supabase
        .from('announcements')
        .insert({
            title,
            content,
            created_by: userId,
            expires_at: expiresAt,
        })
        .select()
        .single()

    if (error) {
        return { error: error.message }
    }

    return { data: data as Announcement }
}

export async function dismissAnnouncement(id: string): Promise<{ success: boolean; error?: string }> {
    const isAdmin = await isSuperAdmin()
    if (!isAdmin) {
        return { success: false, error: 'Only super admins can dismiss announcements' }
    }

    const supabase = await createClient()
    const { error } = await supabase
        .from('announcements')
        .update({ is_active: false })
        .eq('id', id)

    return { success: !error, error: error?.message }
}

// ===========================================
// NOTIFICATIONS
// ===========================================

export async function getNotifications(limit = 20): Promise<FeatureNotification[]> {
    const supabase = await createClient()
    const userId = await getCurrentUserId()

    if (!userId) return []

    const { data, error } = await supabase
        .from('feature_notifications')
        .select(`
            *,
            request:feature_requests(id, title)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit)

    if (error) {
        console.error('Error fetching notifications:', error)
        return []
    }

    return data as FeatureNotification[]
}

export async function getUnreadNotificationCount(): Promise<number> {
    const supabase = await createClient()
    const userId = await getCurrentUserId()

    if (!userId) return 0

    const { count } = await supabase
        .from('feature_notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false)

    return count || 0
}

export async function markNotificationRead(id: string): Promise<{ success: boolean }> {
    const supabase = await createClient()
    const userId = await getCurrentUserId()

    if (!userId) return { success: false }

    const { error } = await supabase
        .from('feature_notifications')
        .update({ is_read: true })
        .eq('id', id)
        .eq('user_id', userId)

    return { success: !error }
}

export async function markAllNotificationsRead(): Promise<{ success: boolean }> {
    const supabase = await createClient()
    const userId = await getCurrentUserId()

    if (!userId) return { success: false }

    const { error } = await supabase
        .from('feature_notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false)

    revalidatePath('/roadmap')
    return { success: !error }
}

// ===========================================
// STATS
// ===========================================

export async function getRoadmapStats(): Promise<RoadmapStats> {
    const admin = createAdminClient()

    const { data, error } = await admin
        .from('feature_requests')
        .select('status')
        .eq('is_archived', false)

    if (error || !data) {
        return {
            total: 0,
            submitted: 0,
            reviewing: 0,
            planned: 0,
            in_progress: 0,
            completed: 0,
            rejected: 0,
        }
    }

    const stats: RoadmapStats = {
        total: data.length,
        submitted: 0,
        reviewing: 0,
        planned: 0,
        in_progress: 0,
        completed: 0,
        rejected: 0,
    }

    for (const req of data) {
        const status = req.status as keyof Omit<RoadmapStats, 'total'>
        if (status in stats) {
            stats[status]++
        }
    }

    return stats
}

export async function getStatusHistory(requestId: string): Promise<FeatureStatusHistory[]> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('feature_status_history')
        .select(`
            *,
            changer:users(id, name, avatar_url)
        `)
        .eq('request_id', requestId)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching status history:', error)
        return []
    }

    return data as FeatureStatusHistory[]
}

// ===========================================
// INTERNAL HELPERS
// ===========================================

async function createNotification(
    userId: string,
    requestId: string | null,
    type: string,
    message: string
): Promise<void> {
    const admin = createAdminClient()

    await admin.from('feature_notifications').insert({
        user_id: userId,
        request_id: requestId,
        type,
        message,
    })
}

async function notifyWatchers(
    requestId: string,
    type: string,
    message: string
): Promise<void> {
    const admin = createAdminClient()
    const currentUserId = await getCurrentUserId()

    // Get all watchers except the current user
    const { data: watchers } = await admin
        .from('feature_watchers')
        .select('user_id')
        .eq('request_id', requestId)
        .neq('user_id', currentUserId || '')

    if (!watchers) return

    // Create notifications for each watcher
    const notifications = watchers.map(w => ({
        user_id: w.user_id,
        request_id: requestId,
        type,
        message,
    }))

    if (notifications.length > 0) {
        await admin.from('feature_notifications').insert(notifications)
    }
}

// ===========================================
// SEARCH USERS (for @mentions)
// ===========================================

export async function searchUsersForMention(query: string): Promise<{ id: string; name: string; avatar_url: string | null }[]> {
    if (!query || query.length < 2) return []

    const admin = createAdminClient()

    const { data, error } = await admin
        .from('users')
        .select('id, name, avatar_url')
        .ilike('name', `%${query}%`)
        .eq('is_active', true)
        .limit(10)

    if (error) {
        console.error('Error searching users:', error)
        return []
    }

    return data || []
}

// ===========================================
// ADMIN ANALYTICS
// ===========================================

export async function getAdminAnalytics() {
    const isAdmin = await isSuperAdmin()
    if (!isAdmin) {
        return null
    }

    const admin = createAdminClient()

    // Get all requests for analytics
    const { data: requests } = await admin
        .from('feature_requests')
        .select('id, title, category, type, status, vote_count, created_at, completed_at')
        .eq('is_archived', false)

    if (!requests) {
        return {
            requestsByCategory: [],
            requestsByType: [],
            requestsByStatus: [],
            topVoted: [],
            recentActivity: [],
            totalVotes: 0,
            totalComments: 0,
            avgTimeToReview: 0,
            avgTimeToComplete: 0,
            completionRate: 0,
        }
    }

    // Aggregate by category
    const categoryMap = new Map<string, number>()
    requests.forEach(r => {
        categoryMap.set(r.category, (categoryMap.get(r.category) || 0) + 1)
    })
    const requestsByCategory = Array.from(categoryMap.entries())
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count)

    // Aggregate by type
    const typeMap = new Map<string, number>()
    requests.forEach(r => {
        typeMap.set(r.type, (typeMap.get(r.type) || 0) + 1)
    })
    const requestsByType = Array.from(typeMap.entries())
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count)

    // Aggregate by status
    const statusMap = new Map<string, number>()
    requests.forEach(r => {
        statusMap.set(r.status, (statusMap.get(r.status) || 0) + 1)
    })
    const requestsByStatus = Array.from(statusMap.entries())
        .map(([status, count]) => ({ status, count }))

    // Top voted
    const topVoted = [...requests]
        .sort((a, b) => b.vote_count - a.vote_count)
        .slice(0, 5)
        .map(r => ({ id: r.id, title: r.title, vote_count: r.vote_count }))

    // Total votes
    const totalVotes = requests.reduce((sum, r) => sum + r.vote_count, 0)

    // Get comment count
    const { count: totalComments } = await admin
        .from('feature_comments')
        .select('*', { count: 'exact', head: true })

    // Completion rate
    const completed = requests.filter(r => r.status === 'completed').length
    const completionRate = requests.length > 0
        ? Math.round((completed / requests.length) * 100)
        : 0

    // Average time calculations (simplified - would need status history for accurate timing)
    const avgTimeToReview = 2 // Placeholder - would calculate from status history
    const avgTimeToComplete = 14 // Placeholder - would calculate from status history

    return {
        requestsByCategory,
        requestsByType,
        requestsByStatus,
        topVoted,
        recentActivity: [],
        totalVotes,
        totalComments: totalComments || 0,
        avgTimeToReview,
        avgTimeToComplete,
        completionRate,
    }
}
