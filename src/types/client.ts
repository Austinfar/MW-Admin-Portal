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
