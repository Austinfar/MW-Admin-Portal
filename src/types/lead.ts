export type LeadStatus = 'New' | 'Contacted' | 'Appt Set' | 'Closed Won' | 'Closed Lost' | 'No Show' | 'converted'

export interface Lead {
    id: string
    first_name: string
    last_name: string | null
    email: string | null
    phone: string | null
    description: string | null
    status: LeadStatus
    source: string | null
    assigned_user_id: string | null
    booked_by_user_id: string | null
    ghl_contact_id: string | null
    is_priority: boolean
    metadata: LeadMetadata | null
    questionnaire_status: string | null
    created_at: string
    updated_at: string
}

export interface LeadMetadata {
    current_step?: string
    coach_selected?: string
    coach_selected_id?: string
    coach_selection_type?: string
    consultation_scheduled_for?: string
    booking_completed_at?: string
    questionnaire?: Record<string, unknown>
    questionnaire_completed_at?: string
    utm_source?: string
    utm_medium?: string
    utm_campaign?: string
    landing_page_url?: string
    source_detail?: string
    last_submission?: string
    last_booking_responses?: Record<string, unknown>
}

export interface EnhancedLead extends Lead {
    assigned_user?: { id: string; name: string } | null
    booked_by_user?: { id: string; name: string } | null
}

export interface LeadFilters {
    statuses: string[]
    sources: string[]
    assignedUsers: string[]
    bookedByUsers: string[]
    hasAppointment: 'all' | 'booked' | 'not_booked'
    priorityOnly: boolean
    onlyMyLeads: boolean
}

export interface LeadStats {
    total: number
    priority: number
    booked: number
    bookingRate: number
    awaitingFollowUp: number
}

export interface LeadFunnelData {
    contactsSubmitted: number
    coachSelected: number
    callBooked: number
    questionnaireDone: number
    closedWon: number
    conversionRate: number
    period: '7d' | '30d' | 'all'
}

export interface LeadSourceData {
    source: string
    count: number
    percentage: number
}

export type SortField = 'priority' | 'name' | 'status' | 'source' | 'setter' | 'closer' | 'created_at' | 'appointment'
export type SortOrder = 'asc' | 'desc'
