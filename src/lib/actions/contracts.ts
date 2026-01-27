'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { addMonths } from 'date-fns'
import {
    ClientContract,
    ClientContractWithAgreement,
    CreateContractInput,
    RenewContractInput,
    ContractStatus,
    PaymentType,
} from '@/types/contract'

// ============================================================================
// Get Contracts
// ============================================================================

/**
 * Get all contracts for a client, ordered by contract number descending
 */
export async function getClientContracts(
    clientId: string
): Promise<ClientContractWithAgreement[]> {
    // Use admin client to bypass RLS for now
    const adminSupabase = createAdminClient()

    const { data, error } = await adminSupabase
        .from('client_contracts')
        .select(`
            *,
            agreement:client_agreements!client_contracts_agreement_id_fkey(
                id,
                status,
                sent_at,
                viewed_at,
                signed_at
            )
        `)
        .eq('client_id', clientId)
        .order('contract_number', { ascending: false })

    if (error) {
        console.error('[Contracts] Error fetching contracts:', error)
        return []
    }

    return data as ClientContractWithAgreement[]
}

/**
 * Get the active contract for a client
 */
export async function getActiveContract(
    clientId: string
): Promise<ClientContract | null> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('client_contracts')
        .select('*')
        .eq('client_id', clientId)
        .eq('status', 'active')
        .order('contract_number', { ascending: false })
        .limit(1)
        .single()

    if (error && error.code !== 'PGRST116') {
        console.error('[Contracts] Error fetching active contract:', error)
    }

    return data as ClientContract | null
}

/**
 * Get a single contract by ID
 */
export async function getContract(
    contractId: string
): Promise<ClientContract | null> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('client_contracts')
        .select('*')
        .eq('id', contractId)
        .single()

    if (error) {
        console.error('[Contracts] Error fetching contract:', error)
        return null
    }

    return data as ClientContract
}

// ============================================================================
// Create Contract
// ============================================================================

/**
 * Create a new contract for a client
 * Used for manual contract creation or when no payment schedule exists
 */
export async function createContract(
    input: CreateContractInput
): Promise<{ success: boolean; contractId?: string; error?: string }> {
    const supabase = await createClient()
    const adminSupabase = createAdminClient()

    // Verify user is authenticated
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return { success: false, error: 'Not authenticated' }
    }

    // Get the next contract number for this client
    const { data: existingContracts } = await supabase
        .from('client_contracts')
        .select('contract_number')
        .eq('client_id', input.client_id)
        .order('contract_number', { ascending: false })
        .limit(1)

    const nextContractNumber = (existingContracts?.[0]?.contract_number || 0) + 1

    // Create the contract
    const { data: contract, error: createError } = await adminSupabase
        .from('client_contracts')
        .insert({
            client_id: input.client_id,
            contract_number: nextContractNumber,
            start_date: input.start_date,
            end_date: input.end_date,
            program_name: input.program_name,
            program_term_months: input.program_term_months,
            payment_type: input.payment_type || null,
            payment_schedule_id: input.payment_schedule_id || null,
            total_value: input.total_value || null,
            monthly_rate: input.monthly_rate || null,
            down_payment: input.down_payment || null,
            installment_count: input.installment_count || null,
            installment_amount: input.installment_amount || null,
            payment_collection_method: input.payment_collection_method || null,
            manual_entry: input.manual_entry || false,
            manual_notes: input.manual_notes || null,
            status: 'active',
        })
        .select('id')
        .single()

    if (createError || !contract) {
        console.error('[Contracts] Error creating contract:', createError)
        return { success: false, error: createError?.message || 'Failed to create contract' }
    }

    // Update client's current_contract_id and contract dates
    const { error: updateError } = await adminSupabase
        .from('clients')
        .update({
            current_contract_id: contract.id,
            start_date: input.start_date,
            contract_end_date: input.end_date,
            program_term_months: input.program_term_months,
            renewal_status: 'pending',
        })
        .eq('id', input.client_id)

    if (updateError) {
        console.error('[Contracts] Error updating client:', updateError)
        // Don't fail the whole operation, contract was created
    }

    revalidatePath(`/clients/${input.client_id}`)

    return { success: true, contractId: contract.id }
}

// ============================================================================
// Renew Contract
// ============================================================================

/**
 * Renew a client's contract
 * Creates a new contract and marks the previous one as completed
 */
export async function renewContract(
    input: RenewContractInput
): Promise<{ success: boolean; contractId?: string; error?: string }> {
    const supabase = await createClient()
    const adminSupabase = createAdminClient()

    // Verify user is authenticated
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return { success: false, error: 'Not authenticated' }
    }

    // Get the previous contract
    const { data: previousContract, error: fetchError } = await supabase
        .from('client_contracts')
        .select('*')
        .eq('id', input.previous_contract_id)
        .single()

    if (fetchError || !previousContract) {
        return { success: false, error: 'Previous contract not found' }
    }

    // Mark previous contract as completed
    const { error: completeError } = await adminSupabase
        .from('client_contracts')
        .update({ status: 'completed' })
        .eq('id', input.previous_contract_id)

    if (completeError) {
        console.error('[Contracts] Error completing previous contract:', completeError)
        return { success: false, error: 'Failed to complete previous contract' }
    }

    // Calculate end date based on term
    const startDate = new Date(input.start_date)
    const endDate = addMonths(startDate, input.program_term_months)

    // Determine payment collection method
    let paymentCollectionMethod: string | null = null
    if (input.renewal_method === 'payment_link') {
        paymentCollectionMethod = 'payment_link'
    } else if (input.renewal_method === 'card_on_file') {
        paymentCollectionMethod = 'card_on_file'
    } else if (input.renewal_method === 'manual') {
        paymentCollectionMethod = 'manual'
    }

    // Create the new contract
    const createInput: CreateContractInput = {
        client_id: input.client_id,
        start_date: input.start_date,
        end_date: endDate.toISOString().split('T')[0],
        program_name: input.program_name,
        program_term_months: input.program_term_months,
        total_value: input.total_value,
        monthly_rate: input.monthly_rate,
        payment_collection_method: paymentCollectionMethod as any,
        manual_entry: input.renewal_method === 'manual',
        manual_notes: input.manual_notes,
    }

    const result = await createContract(createInput)

    if (!result.success) {
        return result
    }

    // Update client's renewal status
    await adminSupabase
        .from('clients')
        .update({
            renewal_status: 'renewed',
            renewal_reminders_sent: { '30_day': null, '14_day': null, '7_day': null },
        })
        .eq('id', input.client_id)

    return result
}

// ============================================================================
// Update Contract Status
// ============================================================================

/**
 * Update a contract's status
 */
export async function updateContractStatus(
    contractId: string,
    status: ContractStatus
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()
    const adminSupabase = createAdminClient()

    // Verify user is authenticated
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return { success: false, error: 'Not authenticated' }
    }

    // Get the contract to find client_id
    const { data: contract, error: fetchError } = await supabase
        .from('client_contracts')
        .select('client_id')
        .eq('id', contractId)
        .single()

    if (fetchError || !contract) {
        return { success: false, error: 'Contract not found' }
    }

    const { error: updateError } = await adminSupabase
        .from('client_contracts')
        .update({ status })
        .eq('id', contractId)

    if (updateError) {
        console.error('[Contracts] Error updating status:', updateError)
        return { success: false, error: 'Failed to update contract status' }
    }

    revalidatePath(`/clients/${contract.client_id}`)

    return { success: true }
}

// ============================================================================
// Link Agreement to Contract
// ============================================================================

/**
 * Link an agreement to a contract
 */
export async function linkAgreementToContract(
    agreementId: string,
    contractId: string
): Promise<{ success: boolean; error?: string }> {
    const adminSupabase = createAdminClient()

    // Update the contract with the agreement ID
    const { error: contractError } = await adminSupabase
        .from('client_contracts')
        .update({ agreement_id: agreementId })
        .eq('id', contractId)

    if (contractError) {
        console.error('[Contracts] Error linking agreement to contract:', contractError)
        return { success: false, error: 'Failed to link agreement to contract' }
    }

    // Update the agreement with the contract ID
    const { error: agreementError } = await adminSupabase
        .from('client_agreements')
        .update({ client_contract_id: contractId })
        .eq('id', agreementId)

    if (agreementError) {
        console.error('[Contracts] Error linking contract to agreement:', agreementError)
        return { success: false, error: 'Failed to link contract to agreement' }
    }

    return { success: true }
}

// ============================================================================
// Create Contract from Payment Schedule
// ============================================================================

/**
 * Create a contract from a payment schedule (called after payment)
 * This is typically called from the Stripe webhook
 */
export async function createContractFromPaymentSchedule(
    clientId: string,
    paymentScheduleId: string
): Promise<{ success: boolean; contractId?: string; error?: string }> {
    const adminSupabase = createAdminClient()

    // Get the payment schedule
    const { data: schedule, error: scheduleError } = await adminSupabase
        .from('payment_schedules')
        .select('*')
        .eq('id', paymentScheduleId)
        .single()

    if (scheduleError || !schedule) {
        console.error('[Contracts] Payment schedule not found:', scheduleError)
        return { success: false, error: 'Payment schedule not found' }
    }

    // Determine payment type from schedule
    let paymentType: PaymentType | null = null
    if (schedule.payment_type === 'one_time') {
        paymentType = 'paid_in_full'
    } else if (schedule.payment_type === 'split') {
        paymentType = 'split_pay'
    } else if (schedule.payment_type === 'recurring') {
        paymentType = 'monthly'
    }

    // Calculate start and end dates
    const startDate = schedule.start_date || new Date().toISOString().split('T')[0]
    const programTermMonths = parseInt(schedule.program_term || '6', 10)
    const endDate = addMonths(new Date(startDate), programTermMonths).toISOString().split('T')[0]

    // Parse installment info from schedule_json if available
    let installmentCount: number | null = null
    let installmentAmount: number | null = null
    let downPayment: number | null = null

    if (schedule.schedule_json && Array.isArray(schedule.schedule_json)) {
        installmentCount = schedule.schedule_json.length
        if (schedule.schedule_json.length > 0) {
            // First payment is typically down payment
            downPayment = schedule.schedule_json[0]?.amount || null
            // Subsequent payments are installments
            if (schedule.schedule_json.length > 1) {
                installmentAmount = schedule.schedule_json[1]?.amount || null
            }
        }
    }

    const input: CreateContractInput = {
        client_id: clientId,
        start_date: startDate,
        end_date: endDate,
        program_name: schedule.plan_name || 'Coaching Program',
        program_term_months: programTermMonths,
        payment_type: paymentType,
        payment_schedule_id: paymentScheduleId,
        total_value: schedule.total_amount || null,
        monthly_rate: schedule.amount || null,
        down_payment: downPayment,
        installment_count: installmentCount,
        installment_amount: installmentAmount,
        payment_collection_method: 'payment_link',
        manual_entry: false,
    }

    return createContract(input)
}

// ============================================================================
// Get Next Contract Number
// ============================================================================

/**
 * Get the next contract number for a client
 */
export async function getNextContractNumber(clientId: string): Promise<number> {
    const supabase = await createClient()

    const { data } = await supabase
        .from('client_contracts')
        .select('contract_number')
        .eq('client_id', clientId)
        .order('contract_number', { ascending: false })
        .limit(1)

    return (data?.[0]?.contract_number || 0) + 1
}
