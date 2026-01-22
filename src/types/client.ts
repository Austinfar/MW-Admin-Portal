export type ClientStatus = 'active' | 'inactive' | 'lost' | 'onboarding'

export interface Client {
    id: string
    name: string
    email: string
    phone: string | null
    status: ClientStatus
    start_date: string
    contract_end_date: string | null
    assigned_coach_id: string | null
    client_type_id: string | null
    ghl_contact_id: string
    lead_source: 'coach_driven' | 'company_driven' | null
    pipeline_stage: string | null
    stripe_customer_id?: string | null
    sold_by_user_id?: string | null // NEW
    check_in_day?: string | null // NEW
    appointment_setter_id?: string | null // Commission system v2
    created_at: string
    // Joined fields
    client_type?: {
        name: string
    } | null
    assigned_coach?: {
        name: string
        email: string
    } | null
    sold_by_user?: {
        name: string
        email: string
    } | null // NEW
    appointment_setter?: {
        name: string
        email: string
    } | null // Commission system v2
}

export interface ClientType {
    id: string
    name: string
    description: string | null
    is_active: boolean
}

export interface Note {
    id: string
    content: string
    is_pinned: boolean
    created_at: string
    author?: {
        name: string
        email: string
        id: string
        avatar_url?: string | null
    } | null
}

// Enhanced client data for list view
export interface EnhancedClient extends Client {
    last_payment_date?: string | null
    last_payment_status?: string | null
    onboarding_total?: number
    onboarding_completed?: number
    lifetime_revenue?: number
}

// Stats for clients list dashboard
export interface ClientStats {
    total: number
    active: number
    atRisk: number
    endingSoon: number
}

// Tag system
export interface ClientTag {
    id: string
    name: string
    color: string
    description?: string | null
    created_by?: string | null
    created_at: string
}

export interface ClientTagAssignment {
    client_id: string
    tag_id: string
    assigned_by?: string | null
    assigned_at: string
    tag?: ClientTag
}

// Alert system
export type AlertType = 'payment_failed' | 'payment_overdue' | 'contract_expiring' | 'onboarding_stalled'
export type AlertSeverity = 'warning' | 'critical'

export interface ClientAlert {
    id: string
    client_id: string
    alert_type: AlertType
    severity: AlertSeverity
    title: string
    description?: string | null
    is_dismissed: boolean
    dismissed_by?: string | null
    dismissed_at?: string | null
    created_at: string
    client?: {
        name: string
        email: string
    } | null
}

// Goal system
export type GoalType = 'outcome' | 'habit' | 'milestone'
export type GoalStatus = 'active' | 'achieved' | 'abandoned'

export interface ClientGoal {
    id: string
    client_id: string
    title: string
    description?: string | null
    goal_type: GoalType
    target_value?: number | null
    target_unit?: string | null
    current_value: number
    target_date?: string | null
    status: GoalStatus
    priority: number
    achieved_at?: string | null
    created_by?: string | null
    created_at: string
    updated_at: string
}

// Document system
export type DocumentType = 'meal_plan' | 'workout_program' | 'intake_form' | 'contract' | 'other'

export interface ClientDocument {
    id: string
    client_id: string
    name: string
    description?: string | null
    document_type: DocumentType
    storage_path: string
    file_size?: number | null
    mime_type?: string | null
    uploaded_by?: string | null
    is_shared_with_client: boolean
    created_at: string
    uploader?: {
        name: string
        email: string
    } | null
}
