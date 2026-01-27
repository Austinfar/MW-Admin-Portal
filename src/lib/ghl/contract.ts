/**
 * GHL Contract Integration
 *
 * Handles pushing contract variables to GHL contacts before sending agreements.
 * Variables are stored as custom fields on the contact, which GHL uses to populate
 * document templates.
 */

import { GHLClient } from './client'
import { createAdminClient } from '@/lib/supabase/admin'
import {
    ContractVariables,
    ContractVariablesSchema,
    GHL_CONTRACT_FIELD_KEYS,
    PaymentType,
} from '@/types/contract'
import { format } from 'date-fns'

interface ClientData {
    id: string
    name: string
    email: string
    phone?: string | null
    ghl_contact_id: string
    assigned_coach?: {
        name: string
        email: string
    } | null
}

interface ContractData {
    start_date: string
    end_date: string
    program_name: string
    program_term_months: number
    payment_type?: PaymentType | null
    total_value?: number | null
    monthly_rate?: number | null
    down_payment?: number | null
    installment_count?: number | null
    installment_amount?: number | null
}

/**
 * Build contract variables object from client and contract data
 */
export function buildContractVariables(
    client: ClientData,
    contract: ContractData
): ContractVariables {
    // Build payment schedule description based on payment type
    let paymentScheduleDescription = ''
    if (contract.payment_type === 'paid_in_full') {
        paymentScheduleDescription = `Paid in Full: $${contract.total_value?.toFixed(2) || '0.00'}`
    } else if (contract.payment_type === 'split_pay') {
        paymentScheduleDescription = `Split Payment: $${contract.down_payment?.toFixed(2) || '0.00'} down, then ${contract.installment_count || 0} payments of $${contract.installment_amount?.toFixed(2) || '0.00'}`
    } else if (contract.payment_type === 'monthly') {
        paymentScheduleDescription = `Monthly Subscription: $${contract.monthly_rate?.toFixed(2) || '0.00'}/month for ${contract.program_term_months} months`
    }

    const variables: ContractVariables = {
        // Client Info
        client_name: client.name,
        client_email: client.email,
        client_phone: client.phone || undefined,

        // Program Info
        program_name: contract.program_name,
        program_term_months: contract.program_term_months,
        monthly_rate: contract.monthly_rate || undefined,
        total_program_value: contract.total_value || undefined,

        // Dates
        start_date: format(new Date(contract.start_date), 'MMMM d, yyyy'),
        end_date: format(new Date(contract.end_date), 'MMMM d, yyyy'),
        first_billing_date: format(new Date(contract.start_date), 'MMMM d, yyyy'),

        // Coach Info
        coach_name: client.assigned_coach?.name || undefined,
        coach_email: client.assigned_coach?.email || undefined,

        // Payment Details
        payment_type: contract.payment_type || undefined,
        down_payment: contract.down_payment || undefined,
        num_installments: contract.installment_count || undefined,
        installment_amount: contract.installment_amount || undefined,
        payment_schedule_description: paymentScheduleDescription || undefined,
    }

    return variables
}

/**
 * Convert contract variables to GHL custom field format
 */
function variablesToGHLCustomFields(variables: ContractVariables): Record<string, string> {
    const customFields: Record<string, string> = {}

    // Map each variable to its GHL field key
    if (variables.program_name) {
        customFields[GHL_CONTRACT_FIELD_KEYS.program_name] = variables.program_name
    }
    if (variables.program_term_months) {
        customFields[GHL_CONTRACT_FIELD_KEYS.term_months] = variables.program_term_months.toString()
    }
    if (variables.monthly_rate !== undefined) {
        customFields[GHL_CONTRACT_FIELD_KEYS.monthly_rate] = variables.monthly_rate.toString()
    }
    if (variables.total_program_value !== undefined) {
        customFields[GHL_CONTRACT_FIELD_KEYS.total_value] = variables.total_program_value.toString()
    }
    if (variables.start_date) {
        customFields[GHL_CONTRACT_FIELD_KEYS.start_date] = variables.start_date
    }
    if (variables.end_date) {
        customFields[GHL_CONTRACT_FIELD_KEYS.end_date] = variables.end_date
    }
    if (variables.first_billing_date) {
        customFields[GHL_CONTRACT_FIELD_KEYS.first_billing] = variables.first_billing_date
    }
    if (variables.coach_name) {
        customFields[GHL_CONTRACT_FIELD_KEYS.coach_name] = variables.coach_name
    }
    if (variables.coach_email) {
        customFields[GHL_CONTRACT_FIELD_KEYS.coach_email] = variables.coach_email
    }
    if (variables.payment_type) {
        // Format payment type for display
        const paymentTypeDisplay = {
            paid_in_full: 'Paid in Full',
            split_pay: 'Split Payment',
            monthly: 'Monthly Subscription',
        }[variables.payment_type]
        customFields[GHL_CONTRACT_FIELD_KEYS.payment_type] = paymentTypeDisplay
    }
    if (variables.down_payment !== undefined) {
        customFields[GHL_CONTRACT_FIELD_KEYS.down_payment] = variables.down_payment.toString()
    }
    if (variables.num_installments !== undefined) {
        customFields[GHL_CONTRACT_FIELD_KEYS.installments] = variables.num_installments.toString()
    }
    if (variables.installment_amount !== undefined) {
        customFields[GHL_CONTRACT_FIELD_KEYS.installment_amount] = variables.installment_amount.toString()
    }
    if (variables.payment_schedule_description) {
        customFields[GHL_CONTRACT_FIELD_KEYS.payment_schedule] = variables.payment_schedule_description
    }

    return customFields
}

/**
 * Push contract variables to a GHL contact
 */
export async function pushContractVariablesToGHL(
    ghlContactId: string,
    variables: ContractVariables
): Promise<{ success: boolean; error?: string }> {
    // Validate variables
    const validated = ContractVariablesSchema.safeParse(variables)
    if (!validated.success) {
        console.error('[GHL Contract] Invalid contract variables:', validated.error.issues)
        return { success: false, error: 'Invalid contract variables' }
    }

    const supabase = createAdminClient()

    // Get GHL tokens from database
    const { data: ghlConfig, error: configError } = await supabase
        .from('ghl_integration_config')
        .select('access_token, refresh_token')
        .single()

    if (configError || !ghlConfig) {
        console.error('[GHL Contract] Failed to get GHL config:', configError)
        return { success: false, error: 'GHL not configured' }
    }

    const client = new GHLClient(ghlConfig.access_token, undefined, {
        refreshToken: ghlConfig.refresh_token,
        onTokenRefresh: async (tokens) => {
            await supabase
                .from('ghl_integration_config')
                .update({
                    access_token: tokens.access_token,
                    refresh_token: tokens.refresh_token,
                })
                .eq('id', (await supabase.from('ghl_integration_config').select('id').single()).data?.id)
        },
    })

    // Convert variables to GHL custom fields format
    const customFields = variablesToGHLCustomFields(variables)

    console.log('[GHL Contract] Pushing contract variables to contact:', ghlContactId)
    console.log('[GHL Contract] Custom fields:', customFields)

    // Update the contact with custom fields
    const result = await client.updateContact(ghlContactId, { customFields })

    if (!result) {
        console.error('[GHL Contract] Failed to update contact')
        return { success: false, error: 'Failed to update GHL contact' }
    }

    console.log('[GHL Contract] Successfully pushed contract variables')
    return { success: true }
}

/**
 * Get the active contract for a client and build variables
 */
export async function getContractVariablesForClient(
    clientId: string
): Promise<{ success: boolean; variables?: ContractVariables; error?: string }> {
    const supabase = createAdminClient()

    // Get client with coach info
    const { data: client, error: clientError } = await supabase
        .from('clients')
        .select(`
            id,
            name,
            email,
            phone,
            ghl_contact_id,
            assigned_coach:users!clients_assigned_coach_id_fkey(name, email)
        `)
        .eq('id', clientId)
        .single()

    if (clientError || !client) {
        return { success: false, error: 'Client not found' }
    }

    // Get the active contract
    const { data: contract, error: contractError } = await supabase
        .from('client_contracts')
        .select('*')
        .eq('client_id', clientId)
        .eq('status', 'active')
        .order('contract_number', { ascending: false })
        .limit(1)
        .single()

    if (contractError || !contract) {
        return { success: false, error: 'No active contract found' }
    }

    // Handle Supabase returning array for single relation
    const coachData = client.assigned_coach
    const coach = Array.isArray(coachData) ? coachData[0] : coachData
    const assignedCoach = coach && typeof coach === 'object' && 'name' in coach && 'email' in coach
        ? (coach as { name: string; email: string })
        : null

    const variables = buildContractVariables(
        {
            id: client.id,
            name: client.name,
            email: client.email,
            phone: client.phone,
            ghl_contact_id: client.ghl_contact_id,
            assigned_coach: assignedCoach,
        },
        {
            start_date: contract.start_date,
            end_date: contract.end_date,
            program_name: contract.program_name,
            program_term_months: contract.program_term_months,
            payment_type: contract.payment_type as PaymentType | null,
            total_value: contract.total_value,
            monthly_rate: contract.monthly_rate,
            down_payment: contract.down_payment,
            installment_count: contract.installment_count,
            installment_amount: contract.installment_amount,
        }
    )

    return { success: true, variables }
}
