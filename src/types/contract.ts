import { z } from 'zod'

// ============================================================================
// Contract Status Types
// ============================================================================

export type ContractStatus = 'active' | 'completed' | 'cancelled'

// How payment was collected (for renewals)
export type PaymentCollectionMethod = 'payment_link' | 'card_on_file' | 'manual'

// The contract/payment structure type
export type PaymentType = 'paid_in_full' | 'split_pay' | 'monthly'

// ============================================================================
// Client Contract Interface
// ============================================================================

export interface ClientContract {
    id: string
    client_id: string
    contract_number: number

    // Dates
    start_date: string
    end_date: string

    // Program Details
    program_name: string
    program_term_months: number

    // Payment Info
    payment_schedule_id: string | null
    payment_type: PaymentType | null // paid_in_full, split_pay, monthly
    total_value: number | null
    monthly_rate: number | null
    down_payment: number | null
    installment_count: number | null
    installment_amount: number | null
    payment_collection_method: PaymentCollectionMethod | null // How payment was collected (for renewals)

    // Manual Entry
    manual_entry: boolean
    manual_notes: string | null

    // Links
    agreement_id: string | null

    // Status
    status: ContractStatus

    // Timestamps
    created_at: string
    updated_at: string
}

// Extended interface with joined data
export interface ClientContractWithAgreement extends ClientContract {
    agreement?: {
        id: string
        status: string
        sent_at: string | null
        viewed_at: string | null
        signed_at: string | null
    } | null
}

// ============================================================================
// Contract Variables for GHL
// ============================================================================

export const ContractVariablesSchema = z.object({
    // Client Info
    client_name: z.string(),
    client_email: z.string().email(),
    client_phone: z.string().optional(),
    client_address: z.string().optional(),

    // Program Info
    program_name: z.string(),
    program_term_months: z.number(),
    monthly_rate: z.number().optional(),
    total_program_value: z.number().optional(),

    // Dates
    start_date: z.string(),
    end_date: z.string(),
    first_billing_date: z.string().optional(),

    // Coach Info
    coach_name: z.string().optional(),
    coach_email: z.string().email().optional(),

    // Payment Details
    payment_type: z.enum(['paid_in_full', 'split_pay', 'monthly']).optional(),
    down_payment: z.number().optional(),
    num_installments: z.number().optional(),
    installment_amount: z.number().optional(),
    payment_schedule_description: z.string().optional(),
})

export type ContractVariables = z.infer<typeof ContractVariablesSchema>

// ============================================================================
// Renewal Calendar Types
// ============================================================================

export type RenewalStatus = 'pending' | 'renewed' | 'churned' | 'in_discussion'

export interface RenewalRemindersSent {
    '30_day': string | null
    '14_day': string | null
    '7_day': string | null
}

export interface RenewalCalendarEvent {
    clientId: string
    clientName: string
    clientEmail: string
    coachId: string | null
    coachName: string | null
    contractId: string
    contractNumber: number
    contractEndDate: string
    programName: string
    renewalStatus: RenewalStatus
    daysUntilExpiration: number
}

// ============================================================================
// Form/Input Types
// ============================================================================

export interface CreateContractInput {
    client_id: string
    start_date: string
    end_date: string
    program_name: string
    program_term_months: number

    // Payment type
    payment_type?: PaymentType // paid_in_full, split_pay, monthly

    // Optional payment info
    payment_schedule_id?: string
    total_value?: number
    monthly_rate?: number
    down_payment?: number
    installment_count?: number
    installment_amount?: number
    payment_collection_method?: PaymentCollectionMethod

    // Manual entry
    manual_entry?: boolean
    manual_notes?: string
}

export interface RenewContractInput {
    client_id: string
    previous_contract_id: string
    start_date: string
    program_term_months: number
    program_name: string

    // Payment method determines how renewal is processed
    renewal_method: 'payment_link' | 'card_on_file' | 'manual'

    // For manual entry
    total_value?: number
    monthly_rate?: number
    manual_notes?: string
}

// ============================================================================
// GHL Custom Field Mapping
// ============================================================================

export const GHL_CONTRACT_FIELD_KEYS = {
    program_name: 'mw_contract_program_name',
    term_months: 'mw_contract_term_months',
    monthly_rate: 'mw_contract_monthly_rate',
    total_value: 'mw_contract_total_value',
    start_date: 'mw_contract_start_date',
    end_date: 'mw_contract_end_date',
    first_billing: 'mw_contract_first_billing',
    coach_name: 'mw_contract_coach_name',
    coach_email: 'mw_contract_coach_email',
    payment_type: 'mw_contract_payment_type', // paid_in_full, split_pay, monthly
    down_payment: 'mw_contract_down_payment',
    installments: 'mw_contract_installments',
    installment_amount: 'mw_contract_installment_amount',
    payment_schedule: 'mw_contract_payment_schedule',
} as const
