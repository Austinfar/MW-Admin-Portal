'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { GHLClient } from '@/lib/ghl/client'
import { revalidatePath } from 'next/cache'
import {
    getContractVariablesForClient,
    pushContractVariablesToGHL,
} from '@/lib/ghl/contract'
import { linkAgreementToContract } from './contracts'

export interface Agreement {
    id: string
    client_id: string
    ghl_document_id: string | null
    template_id: string
    template_name: string | null
    status: 'draft' | 'sent' | 'viewed' | 'signed' | 'voided' | 'expired'
    sent_at: string | null
    viewed_at: string | null
    signed_at: string | null
    voided_at: string | null
    voided_reason: string | null
    signed_document_url: string | null
    sent_by: string | null
    created_at: string
    updated_at: string
    // Joined data
    sent_by_user?: {
        name: string
    }
}

// Template IDs for different payment types
const GHL_AGREEMENT_TEMPLATES = {
    paid_in_full: process.env.GHL_AGREEMENT_TEMPLATE_PAID_IN_FULL || '',
    split_pay: process.env.GHL_AGREEMENT_TEMPLATE_SPLIT_PAY || '',
    monthly: process.env.GHL_AGREEMENT_TEMPLATE_MONTHLY || '',
    // Fallback for when no specific template is configured
    default: process.env.GHL_COACHING_AGREEMENT_TEMPLATE_ID || '',
}

// Template display names
const TEMPLATE_NAMES: Record<string, string> = {
    paid_in_full: 'Paid in Full Agreement',
    split_pay: 'Split Pay Agreement',
    monthly: 'Monthly Subscription Agreement',
}

/**
 * Get all agreements for a client
 */
export async function getClientAgreements(clientId: string): Promise<Agreement[]> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('client_agreements')
        .select(`
            *,
            sent_by_user:users!client_agreements_sent_by_fkey(name)
        `)
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('[Agreements] Error fetching agreements:', error)
        return []
    }

    return data as Agreement[]
}

/**
 * Get the active (non-voided, non-expired) agreement for a client
 */
export async function getActiveAgreement(clientId: string): Promise<Agreement | null> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('client_agreements')
        .select(`
            *,
            sent_by_user:users!client_agreements_sent_by_fkey(name)
        `)
        .eq('client_id', clientId)
        .not('status', 'in', '("voided","expired")')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('[Agreements] Error fetching active agreement:', error)
    }

    return data as Agreement | null
}

/**
 * Send a coaching agreement to a client via GHL
 */
export async function sendAgreement(
    clientId: string,
    templateId?: string
): Promise<{ success: boolean; agreementId?: string; error?: string }> {
    const supabase = await createClient()
    const adminSupabase = createAdminClient()

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return { success: false, error: 'Not authenticated' }
    }

    // Get client with GHL contact ID
    const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('id, name, ghl_contact_id')
        .eq('id', clientId)
        .single()

    if (clientError || !client) {
        return { success: false, error: 'Client not found' }
    }

    if (!client.ghl_contact_id) {
        return { success: false, error: 'Client does not have a GHL contact ID' }
    }

    // Get the active contract to determine template and build variables
    const { data: activeContract } = await adminSupabase
        .from('client_contracts')
        .select('id, payment_type, program_name')
        .eq('client_id', clientId)
        .eq('status', 'active')
        .order('contract_number', { ascending: false })
        .limit(1)
        .single()

    // Determine which template to use based on payment type
    let agreementTemplateId = templateId
    let templateName = 'Coaching Agreement'

    if (!agreementTemplateId && activeContract?.payment_type) {
        const paymentType = activeContract.payment_type as keyof typeof GHL_AGREEMENT_TEMPLATES
        agreementTemplateId = GHL_AGREEMENT_TEMPLATES[paymentType] || GHL_AGREEMENT_TEMPLATES.default
        templateName = TEMPLATE_NAMES[paymentType] || 'Coaching Agreement'
        console.log(`[Agreements] Using ${paymentType} template for payment type`)
    } else if (!agreementTemplateId) {
        agreementTemplateId = GHL_AGREEMENT_TEMPLATES.default
    }

    if (!agreementTemplateId) {
        return { success: false, error: 'No agreement template configured. Please set template IDs in environment variables.' }
    }

    // Get the active contract and build variables
    const variablesResult = await getContractVariablesForClient(clientId)
    let contractVariables = null
    let activeContractId: string | null = activeContract?.id || null

    if (variablesResult.success && variablesResult.variables) {
        contractVariables = variablesResult.variables

        // Push contract variables to GHL before sending document
        console.log('[Agreements] Pushing contract variables to GHL...')
        const pushResult = await pushContractVariablesToGHL(
            client.ghl_contact_id,
            contractVariables
        )

        if (!pushResult.success) {
            console.warn('[Agreements] Failed to push contract variables:', pushResult.error)
            // Continue anyway - the document can still be sent
        }
    } else {
        console.warn('[Agreements] No active contract found, sending without variables')
    }

    // Create agreement record in draft status first
    const { data: agreement, error: createError } = await adminSupabase
        .from('client_agreements')
        .insert({
            client_id: clientId,
            template_id: agreementTemplateId,
            template_name: templateName,
            status: 'draft',
            sent_by: user.id,
            contract_variables: contractVariables || {},
            client_contract_id: activeContractId,
        })
        .select('id')
        .single()

    if (createError || !agreement) {
        console.error('[Agreements] Error creating agreement:', createError)
        return { success: false, error: 'Failed to create agreement record' }
    }

    // Link agreement to contract if we have one
    if (activeContractId) {
        await linkAgreementToContract(agreement.id, activeContractId)
    }

    // Send document via GHL
    try {
        const ghlClient = new GHLClient()
        const result = await ghlClient.sendDocument(client.ghl_contact_id, agreementTemplateId)

        if (!result?.documentId) {
            // Mark agreement as failed
            await adminSupabase
                .from('client_agreements')
                .update({ status: 'voided', voided_reason: 'Failed to send via GHL' })
                .eq('id', agreement.id)

            return { success: false, error: 'Failed to send document via GHL' }
        }

        // Update agreement with GHL document ID and sent status
        await adminSupabase
            .from('client_agreements')
            .update({
                ghl_document_id: result.documentId,
                status: 'sent',
                sent_at: new Date().toISOString(),
            })
            .eq('id', agreement.id)

        // Create notification for admins
        await adminSupabase.from('feature_notifications').insert({
            user_id: user.id,
            type: 'agreement_sent',
            category: 'client',
            message: `Agreement sent to ${client.name}`,
            is_read: true, // Mark as read for the sender
        })

        revalidatePath(`/clients/${clientId}`)

        return { success: true, agreementId: agreement.id }
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        console.error('[Agreements] GHL API error:', errorMsg)

        // Mark agreement as failed
        await adminSupabase
            .from('client_agreements')
            .update({ status: 'voided', voided_reason: `GHL error: ${errorMsg}` })
            .eq('id', agreement.id)

        return { success: false, error: `GHL error: ${errorMsg}` }
    }
}

/**
 * Void an agreement
 */
export async function voidAgreement(
    agreementId: string,
    reason: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()
    const adminSupabase = createAdminClient()

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return { success: false, error: 'Not authenticated' }
    }

    // Get agreement
    const { data: agreement, error: fetchError } = await supabase
        .from('client_agreements')
        .select('id, client_id, ghl_document_id, status')
        .eq('id', agreementId)
        .single()

    if (fetchError || !agreement) {
        return { success: false, error: 'Agreement not found' }
    }

    if (agreement.status === 'signed') {
        return { success: false, error: 'Cannot void a signed agreement' }
    }

    if (agreement.status === 'voided') {
        return { success: false, error: 'Agreement is already voided' }
    }

    // Void in GHL if we have a document ID
    if (agreement.ghl_document_id) {
        try {
            const ghlClient = new GHLClient()
            await ghlClient.voidDocument(agreement.ghl_document_id)
        } catch (error) {
            console.warn('[Agreements] Failed to void in GHL:', error)
            // Continue anyway - we'll void locally
        }
    }

    // Update agreement status
    const { error: updateError } = await adminSupabase
        .from('client_agreements')
        .update({
            status: 'voided',
            voided_at: new Date().toISOString(),
            voided_reason: reason,
            voided_by: user.id,
        })
        .eq('id', agreementId)

    if (updateError) {
        console.error('[Agreements] Error voiding agreement:', updateError)
        return { success: false, error: 'Failed to void agreement' }
    }

    revalidatePath(`/clients/${agreement.client_id}`)

    return { success: true }
}

/**
 * Resend an agreement (creates a new one, voids the old)
 */
export async function resendAgreement(
    agreementId: string
): Promise<{ success: boolean; newAgreementId?: string; error?: string }> {
    const supabase = await createClient()

    // Get the existing agreement
    const { data: agreement, error: fetchError } = await supabase
        .from('client_agreements')
        .select('client_id, template_id')
        .eq('id', agreementId)
        .single()

    if (fetchError || !agreement) {
        return { success: false, error: 'Agreement not found' }
    }

    // Void the old agreement
    const voidResult = await voidAgreement(agreementId, 'Resent')
    if (!voidResult.success) {
        // If we can't void, still try to send a new one
        console.warn('[Agreements] Could not void old agreement:', voidResult.error)
    }

    // Send a new agreement
    return sendAgreement(agreement.client_id, agreement.template_id)
}

/**
 * Update agreement status (called from GHL webhook)
 * This uses admin client as it's called from a webhook, not a user session
 */
export async function updateAgreementFromWebhook(
    ghlDocumentId: string,
    status: 'viewed' | 'signed' | 'expired',
    signedDocumentUrl?: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = createAdminClient()

    // Find agreement by GHL document ID
    const { data: agreement, error: fetchError } = await supabase
        .from('client_agreements')
        .select('id, client_id, status')
        .eq('ghl_document_id', ghlDocumentId)
        .single()

    if (fetchError || !agreement) {
        console.error('[Agreements] Agreement not found for GHL doc:', ghlDocumentId)
        return { success: false, error: 'Agreement not found' }
    }

    // Don't update if already in a terminal state
    if (['signed', 'voided', 'expired'].includes(agreement.status) && status !== 'signed') {
        return { success: true } // Already finalized
    }

    const updates: Record<string, unknown> = { status }

    if (status === 'viewed') {
        updates.viewed_at = new Date().toISOString()
    } else if (status === 'signed') {
        updates.signed_at = new Date().toISOString()
        if (signedDocumentUrl) {
            updates.signed_document_url = signedDocumentUrl
        }
    } else if (status === 'expired') {
        // No additional fields needed
    }

    const { error: updateError } = await supabase
        .from('client_agreements')
        .update(updates)
        .eq('id', agreement.id)

    if (updateError) {
        console.error('[Agreements] Error updating agreement:', updateError)
        return { success: false, error: 'Failed to update agreement' }
    }

    // Create notification for signed agreements
    if (status === 'signed') {
        // Get client name for notification
        const { data: client } = await supabase
            .from('clients')
            .select('name, assigned_coach_id')
            .eq('id', agreement.client_id)
            .single()

        if (client) {
            // Notify the assigned coach
            if (client.assigned_coach_id) {
                await supabase.from('feature_notifications').insert({
                    user_id: client.assigned_coach_id,
                    type: 'agreement_signed',
                    category: 'client',
                    message: `${client.name} signed their coaching agreement!`,
                    is_read: false,
                })
            }

            // Notify admins
            await supabase.from('feature_notifications').insert({
                type: 'agreement_signed',
                category: 'client',
                message: `${client.name} signed their coaching agreement`,
                target_role: 'admin',
                is_read: false,
            })
        }
    }

    // Revalidate client page
    revalidatePath(`/clients/${agreement.client_id}`)

    return { success: true }
}
