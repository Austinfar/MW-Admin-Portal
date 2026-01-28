export interface OnboardingTemplate {
    id: string
    name: string
    description: string | null
    created_at: string
}

export interface OnboardingTaskTemplate {
    id: string
    template_id: string
    title: string
    description: string | null
    due_offset_days: number
    is_required: boolean
    display_order: number
    assignment_type: 'unassigned' | 'specific_user' | 'assigned_coach'
    default_assigned_user_id: string | null
    created_at: string
}

export interface OnboardingTask {
    id: string
    client_id: string
    task_template_id: string | null
    title: string
    description: string | null
    due_date: string | null
    status: 'pending' | 'completed' | 'cancelled'
    completed_at: string | null
    completed_by: string | null
    assigned_user_id: string | null
    created_at: string
}
