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
    schedule_json?: any[]
}

/**
 * Convert number to words (basic implementation for contract terms)
 */
function numberToWords(num: number): string {
    const words: Record<number, string> = {
        1: 'One', 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five',
        6: 'Six', 7: 'Seven', 8: 'Eight', 9: 'Nine', 10: 'Ten',
        11: 'Eleven', 12: 'Twelve', 18: 'Eighteen', 24: 'Twenty-Four',
        36: 'Thirty-Six'
    }
    return words[num] || num.toString()
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

    // Helper to get ordinal suffix (1st, 2nd, 3rd...)
    const getOrdinal = (n: number) => {
        const s = ["th", "st", "nd", "rd"];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
    }

    if (contract.payment_type === 'paid_in_full') {
        paymentScheduleDescription = `Paid in Full: $${contract.total_value?.toFixed(2) || '0.00'}`
    } else if (contract.payment_type === 'split_pay') {
        const parts: string[] = []

        if (contract.schedule_json && Array.isArray(contract.schedule_json) && contract.schedule_json.length > 0) {
            // Custom split payment schedule from schedule_json
            contract.schedule_json.forEach((item, index) => {
                const amount = item.amount ? `$${Number(item.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '$0.00'

                let dateStr = 'Date TBD'
                if (item.date) {
                    const dRaw = item.date
                    const dSafe = dRaw.length === 10 && !dRaw.includes('T') ? `${dRaw}T12:00:00` : dRaw
                    dateStr = format(new Date(dSafe), 'M/d/yyyy')
                }

                parts.push(`${getOrdinal(index + 1)} Payment: ${amount} on ${dateStr}`)
            })
        } else {
            // Standard uniform split payment fallback - Generate projected schedule
            // Logic: Down payment (1st) today, then remaining installments monthly
            const downPayment = contract.down_payment || 0
            const installmentAmount = contract.installment_amount || 0
            const count = contract.installment_count || 0

            // Safe parse start date
            const sDateRaw = contract.start_date;
            const sDateSafe = sDateRaw.length === 10 && !sDateRaw.includes('T') ? `${sDateRaw}T12:00:00` : sDateRaw;
            const startDate = new Date(sDateSafe)

            // 1st Payment (Down Payment)
            parts.push(`1st Payment: $${downPayment.toFixed(2)} on ${format(startDate, 'M/d/yyyy')}`)

            // Subsequent payments (Installments)
            for (let i = 0; i < count; i++) {
                // Next payment is i+1 months from start (assuming 1 month gap for first installment?)
                // Usually installments start 1 month after down payment
                const nextDate = new Date(startDate)
                nextDate.setMonth(startDate.getMonth() + (i + 1))
                parts.push(`${getOrdinal(i + 2)} Payment: $${installmentAmount.toFixed(2)} on ${format(nextDate, 'M/d/yyyy')}`)
            }
        }
        paymentScheduleDescription = parts.join('\n')

    } else if (contract.payment_type === 'monthly') {
        paymentScheduleDescription = `Monthly Subscription: $${contract.monthly_rate?.toFixed(2) || '0.00'}/month for ${contract.program_term_months} months`
    }

    // Helper to parse YYYY-MM-DD safely preventing timezone drift
    const safeDate = (dateStr: string) => {
        if (!dateStr) return new Date()
        // If it's just a date string (YYYY-MM-DD), force it to noon to avoid UTC midnight drift
        const safeStr = dateStr.length === 10 && !dateStr.includes('T') ? `${dateStr}T12:00:00` : dateStr
        return new Date(safeStr)
    }

    const variables: ContractVariables = {
        // Client Info
        client_name: client.name,
        client_email: client.email,
        client_phone: client.phone || undefined,

        // Program Info
        program_name: contract.program_name,
        program_term_months: contract.program_term_months,
        program_term_letters: numberToWords(contract.program_term_months),
        monthly_rate: contract.monthly_rate || undefined,
        total_program_value: contract.total_value || undefined,

        // Dates
        start_date: format(safeDate(contract.start_date), 'MMMM d, yyyy'),
        end_date: format(safeDate(contract.end_date), 'MMMM d, yyyy'),
        first_billing_date: format(safeDate(contract.start_date), 'MMMM d, yyyy'),

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
 * Convert contract variables to GHL custom field format (Array of objects with key and value)
 * NOTE: GHL V2 technically requires ID, but we are trying key because user cannot provide read scope.
 * If this fails, we must require the scope.
 */
/**
 * Convert contract variables to GHL custom field format (Array of objects with key and value)
 * NOTE: GHL V2 technically requires ID, but we are trying key because user cannot provide read scope.
 * If this fails, we must require the scope.
 */
function variablesToGHLCustomFields(variables: ContractVariables): Array<{ key: string; value: string }> {
    const customFields: Array<{ key: string; value: string }> = []

    // Helper to add field
    const addField = (key: string, value: string | undefined) => {
        if (value !== undefined) {
            customFields.push({
                key: key,
                value: value
            })
        }
    }

    // Map each variable to its GHL field key
    addField(GHL_CONTRACT_FIELD_KEYS.program_name, variables.program_name)
    addField(GHL_CONTRACT_FIELD_KEYS.term_months, variables.program_term_months?.toString())
    addField(GHL_CONTRACT_FIELD_KEYS.term_letters, variables.program_term_letters)
    addField(GHL_CONTRACT_FIELD_KEYS.monthly_rate, variables.monthly_rate?.toString())
    addField(GHL_CONTRACT_FIELD_KEYS.total_value, variables.total_program_value?.toString())
    addField(GHL_CONTRACT_FIELD_KEYS.start_date, variables.start_date)
    addField(GHL_CONTRACT_FIELD_KEYS.end_date, variables.end_date)
    addField(GHL_CONTRACT_FIELD_KEYS.first_billing, variables.first_billing_date)
    addField(GHL_CONTRACT_FIELD_KEYS.coach_name, variables.coach_name)
    addField(GHL_CONTRACT_FIELD_KEYS.coach_email, variables.coach_email)

    if (variables.payment_type) {
        // Format payment type for display
        const paymentTypeDisplay = {
            paid_in_full: 'Paid in Full',
            split_pay: 'Split Payment',
            monthly: 'Monthly Subscription',
        }[variables.payment_type]
        addField(GHL_CONTRACT_FIELD_KEYS.payment_type, paymentTypeDisplay)
    }

    addField(GHL_CONTRACT_FIELD_KEYS.down_payment, variables.down_payment?.toString())
    addField(GHL_CONTRACT_FIELD_KEYS.installments, variables.num_installments?.toString())
    addField(GHL_CONTRACT_FIELD_KEYS.installment_amount, variables.installment_amount?.toString())
    addField(GHL_CONTRACT_FIELD_KEYS.payment_schedule, variables.payment_schedule_description)

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

    // Get GHL tokens from app_settings
    const { data: settings, error: configError } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['ghl_access_token', 'ghl_refresh_token'])

    if (configError || !settings) {
        console.error('[GHL Contract] Failed to get GHL settings:', configError)
        return { success: false, error: 'GHL not configured' }
    }

    const accessToken = settings.find(s => s.key === 'ghl_access_token')?.value
    const refreshToken = settings.find(s => s.key === 'ghl_refresh_token')?.value

    if (!accessToken || !refreshToken) {
        console.error('[GHL Contract] Missing GHL tokens in app_settings')
        return { success: false, error: 'GHL not configured' }
    }

    const client = new GHLClient(accessToken, undefined, {
        refreshToken: refreshToken,
        onTokenRefresh: async (tokens) => {
            // Update tokens in app_settings
            await supabase
                .from('app_settings')
                .upsert([
                    { key: 'ghl_access_token', value: tokens.access_token, updated_at: new Date().toISOString() },
                    { key: 'ghl_refresh_token', value: tokens.refresh_token, updated_at: new Date().toISOString() }
                ])
        },
    })

    // NOTE: Sending custom fields using 'key' instead of 'id' because permission to read custom fields is restricted.
    // Convert variables to GHL custom fields format (using keys)
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

    // Fetch payment schedule if present to get schedule_json
    let scheduleJson: any[] | undefined
    if (contract.payment_schedule_id) {
        const { data: schedule } = await supabase
            .from('payment_schedules')
            .select('schedule_json')
            .eq('id', contract.payment_schedule_id)
            .single()

        if (schedule?.schedule_json) {
            scheduleJson = schedule.schedule_json as any[]
        }
    }

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
            schedule_json: scheduleJson,
        }
    )

    return { success: true, variables }
}
