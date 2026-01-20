/**
 * Types for the Feature Request & Roadmap System
 */

// ===========================================
// ENUMS
// ===========================================

export type RequestStatus =
    | 'submitted'
    | 'reviewing'
    | 'planned'
    | 'in_progress'
    | 'completed'
    | 'rejected'
    | 'duplicate'

export type RequestCategory =
    | 'dashboard'
    | 'clients'
    | 'leads'
    | 'payments'
    | 'reports'
    | 'integrations'
    | 'general'

export type RequestType =
    | 'bug'
    | 'feature'
    | 'improvement'
    | 'integration'

export type RequestPriority =
    | 'low'
    | 'medium'
    | 'high'
    | 'critical'

export type EffortEstimate =
    | 'xs'
    | 's'
    | 'm'
    | 'l'
    | 'xl'

export type NotificationType =
    | 'status_change'
    | 'new_comment'
    | 'mention'
    | 'completed'

// ===========================================
// UI CONSTANTS
// ===========================================

export const STATUS_CONFIG: Record<RequestStatus, { label: string; color: string; bgColor: string; borderColor: string }> = {
    submitted: { label: 'Submitted', color: 'text-zinc-400', bgColor: 'bg-zinc-500/10', borderColor: 'border-zinc-500/20' },
    reviewing: { label: 'Under Review', color: 'text-blue-400', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/20' },
    planned: { label: 'Planned', color: 'text-amber-400', bgColor: 'bg-amber-500/10', borderColor: 'border-amber-500/20' },
    in_progress: { label: 'In Progress', color: 'text-neon-green', bgColor: 'bg-neon-green/10', borderColor: 'border-neon-green/20' },
    completed: { label: 'Completed', color: 'text-emerald-400', bgColor: 'bg-emerald-500/10', borderColor: 'border-emerald-500/20' },
    rejected: { label: 'Rejected', color: 'text-red-400', bgColor: 'bg-red-500/10', borderColor: 'border-red-500/20' },
    duplicate: { label: 'Duplicate', color: 'text-zinc-500', bgColor: 'bg-zinc-600/10', borderColor: 'border-zinc-600/20' },
}

export const CATEGORY_CONFIG: Record<RequestCategory, { label: string; icon: string }> = {
    dashboard: { label: 'Dashboard', icon: '📊' },
    clients: { label: 'Clients', icon: '👥' },
    leads: { label: 'Leads', icon: '🎯' },
    payments: { label: 'Payments', icon: '💳' },
    reports: { label: 'Reports', icon: '📈' },
    integrations: { label: 'Integrations', icon: '🔗' },
    general: { label: 'General', icon: '💡' },
}

export const TYPE_CONFIG: Record<RequestType, { label: string; icon: string; color: string }> = {
    bug: { label: 'Bug', icon: '🐛', color: 'text-red-400' },
    feature: { label: 'Feature', icon: '✨', color: 'text-purple-400' },
    improvement: { label: 'Improvement', icon: '⚡', color: 'text-blue-400' },
    integration: { label: 'Integration', icon: '🔗', color: 'text-cyan-400' },
}

export const PRIORITY_CONFIG: Record<RequestPriority, { label: string; color: string; weight: number }> = {
    low: { label: 'Low', color: 'text-zinc-400', weight: 0 },
    medium: { label: 'Medium', color: 'text-blue-400', weight: 20 },
    high: { label: 'High', color: 'text-amber-400', weight: 50 },
    critical: { label: 'Critical', color: 'text-red-400', weight: 100 },
}

export const EFFORT_CONFIG: Record<EffortEstimate, { label: string; description: string }> = {
    xs: { label: 'XS', description: 'A few hours' },
    s: { label: 'S', description: '1-2 days' },
    m: { label: 'M', description: '3-5 days' },
    l: { label: 'L', description: '1-2 weeks' },
    xl: { label: 'XL', description: '2+ weeks' },
}

export const REACTION_EMOJIS = ['👍', '👀', '🎉', '❤️', '🚀', '👏'] as const

// ===========================================
// INTERFACES
// ===========================================

export interface UserSummary {
    id: string
    name: string | null
    avatar_url: string | null
}

export interface ExternalLink {
    title: string
    url: string
}

export interface FeatureRequest {
    id: string
    title: string
    description: string
    category: RequestCategory
    type: RequestType
    priority: RequestPriority
    status: RequestStatus

    // Relationships
    submitter_id: string
    submitter?: UserSummary | null
    assigned_to?: string | null
    assignee?: UserSummary | null
    milestone_id?: string | null
    milestone?: Milestone | null

    // Counts
    vote_count: number
    watcher_count: number
    comment_count: number

    // User-specific state (computed in queries)
    has_voted?: boolean
    is_watching?: boolean

    // Planning
    target_quarter?: string | null
    effort_estimate?: EffortEstimate | null
    priority_score: number

    // Metadata
    tags: string[]
    related_request_ids: string[]
    external_links: ExternalLink[]
    screenshot_urls: string[]

    // Admin
    admin_notes?: string | null
    rejection_reason?: string | null
    release_notes?: string | null

    // State
    is_archived: boolean
    completed_at?: string | null
    created_at: string
    updated_at: string
}

export interface FeatureVote {
    id: string
    request_id: string
    user_id: string
    created_at: string
}

export interface FeatureComment {
    id: string
    request_id: string
    user_id: string
    user?: UserSummary | null
    content: string
    is_admin_response: boolean
    reactions: Record<string, string[]> // emoji -> user_ids
    created_at: string
    updated_at: string
}

export interface FeatureWatcher {
    id: string
    request_id: string
    user_id: string
    created_at: string
}

export interface FeatureStatusHistory {
    id: string
    request_id: string
    old_status: RequestStatus | null
    new_status: RequestStatus
    changed_by: string
    changer?: UserSummary | null
    note?: string | null
    created_at: string
}

export interface FeatureTag {
    id: string
    name: string
    color: string
    created_at: string
}

export interface Milestone {
    id: string
    name: string
    description?: string | null
    target_date?: string | null
    is_completed: boolean
    created_at: string
    updated_at: string
}

export interface Announcement {
    id: string
    title: string
    content: string
    is_active: boolean
    created_by: string
    creator?: UserSummary | null
    created_at: string
    expires_at?: string | null
}

export interface FeatureNotification {
    id: string
    user_id: string
    request_id?: string | null
    request?: { id: string; title: string } | null
    type: NotificationType
    message: string
    is_read: boolean
    created_at: string
}

// ===========================================
// API TYPES
// ===========================================

export interface CreateRequestInput {
    title: string
    description: string
    category: RequestCategory
    type: RequestType
    priority: RequestPriority
    screenshot_urls?: string[]
}

export interface UpdateRequestInput {
    id: string
    status?: RequestStatus
    assigned_to?: string | null
    milestone_id?: string | null
    target_quarter?: string | null
    effort_estimate?: EffortEstimate | null
    tags?: string[]
    admin_notes?: string | null
    rejection_reason?: string | null
    release_notes?: string | null
    related_request_ids?: string[]
    external_links?: ExternalLink[]
}

export interface RequestFilters {
    status?: RequestStatus | RequestStatus[]
    category?: RequestCategory | RequestCategory[]
    type?: RequestType | RequestType[]
    priority?: RequestPriority | RequestPriority[]
    submitter_id?: string
    assigned_to?: string
    milestone_id?: string
    search?: string
    is_archived?: boolean
}

export interface RequestSortOptions {
    field: 'vote_count' | 'created_at' | 'updated_at' | 'priority_score' | 'comment_count'
    direction: 'asc' | 'desc'
}

export interface PaginationOptions {
    page: number
    limit: number
}

export interface RequestListResult {
    data: FeatureRequest[]
    total: number
    page: number
    limit: number
    totalPages: number
}

export interface RoadmapStats {
    total: number
    submitted: number
    reviewing: number
    planned: number
    in_progress: number
    completed: number
    rejected: number
}

// ===========================================
// KANBAN TYPES
// ===========================================

export type KanbanColumnId = 'planned' | 'in_progress' | 'completed'

export interface KanbanColumn {
    id: KanbanColumnId
    title: string
    status: RequestStatus
    requests: FeatureRequest[]
}

// ===========================================
// FORM TYPES
// ===========================================

export interface SubmitRequestFormData {
    title: string
    description: string
    category: RequestCategory
    type: RequestType
    priority: RequestPriority
    screenshots: File[]
}

export interface CommentFormData {
    content: string
    mentions: string[] // user IDs mentioned
}
