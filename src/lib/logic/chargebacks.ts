import { createAdminClient } from '@/lib/supabase/admin'
import Stripe from 'stripe'

/**
 * Handle a Stripe refund event.
 * Creates negative commission adjustments for each affected recipient.
 */
export async function handleRefund(charge: Stripe.Charge): Promise<void> {
    const supabase = createAdminClient()

    // Find the Payment by stripe_payment_id (PaymentIntent ID)
    const paymentIntentId = typeof charge.payment_intent === 'string'
        ? charge.payment_intent
        : charge.payment_intent?.id

    if (!paymentIntentId) {
        console.log('Chargeback: No payment_intent on charge')
        return
    }

    const { data: payment } = await supabase
        .from('payments')
        .select('id, amount, client_id')
        .eq('stripe_payment_id', paymentIntentId)
        .single()

    if (!payment) {
        console.log('Chargeback: Payment not found for', paymentIntentId)
        return
    }

    const refundAmount = charge.amount_refunded / 100 // Convert cents to dollars
    const isFullRefund = refundAmount >= Number(payment.amount)

    // Update Payment Record
    const { error: updateError } = await supabase
        .from('payments')
        .update({
            status: isFullRefund ? 'refunded' : 'partially_refunded',
            refund_amount: refundAmount,
            refunded_at: new Date().toISOString()
        })
        .eq('id', payment.id)

    if (updateError) {
        console.error('Chargeback: Failed to update payment', updateError)
    }

    // Find Commission Ledger Entries for this Payment
    const { data: ledgerEntries } = await supabase
        .from('commission_ledger')
        .select('id, user_id, commission_amount, status, payroll_run_id, split_role, client_id')
        .eq('payment_id', payment.id)

    if (!ledgerEntries || ledgerEntries.length === 0) {
        console.log('Chargeback: No commission entries found for payment', payment.id)
        return
    }

    // Get client name for the adjustment reason
    let clientName = 'Unknown Client'
    if (payment.client_id) {
        const { data: client } = await supabase
            .from('clients')
            .select('name')
            .eq('id', payment.client_id)
            .single()
        clientName = client?.name || clientName
    }

    // Create Chargeback Adjustments for each recipient
    for (const entry of ledgerEntries) {
        // Calculate proportional refund amount for this entry
        const proportionalRefund = isFullRefund
            ? Number(entry.commission_amount)
            : (refundAmount / Number(payment.amount)) * Number(entry.commission_amount)

        // Create negative adjustment
        const { error: adjustmentError } = await supabase
            .from('commission_adjustments')
            .insert({
                user_id: entry.user_id,
                amount: -proportionalRefund, // Negative amount
                adjustment_type: 'chargeback',
                reason: `Refund for ${clientName}'s payment`,
                notes: `Original commission: $${Number(entry.commission_amount).toFixed(2)}. ${isFullRefund ? 'Full' : 'Partial'} refund of $${refundAmount.toFixed(2)} processed.`,
                related_ledger_id: entry.id,
                related_payment_id: payment.id,
                is_visible_to_user: true
            })

        if (adjustmentError) {
            console.error('Chargeback: Failed to create adjustment', adjustmentError)
            continue
        }

        // If the original entry is still pending (not paid out yet), void it
        if (entry.status === 'pending' && isFullRefund) {
            await supabase
                .from('commission_ledger')
                .update({ status: 'void' })
                .eq('id', entry.id)
        }

        // Create notification for the affected user
        await createChargebackNotification(supabase, entry.user_id, clientName, proportionalRefund)
    }

    console.log(`Chargeback: Processed ${isFullRefund ? 'full' : 'partial'} refund for payment ${payment.id}`)
}

/**
 * Handle a Stripe dispute created event.
 * Marks the payment as disputed.
 */
export async function handleDisputeCreated(dispute: Stripe.Dispute): Promise<void> {
    const supabase = createAdminClient()

    const paymentIntentId = typeof dispute.payment_intent === 'string'
        ? dispute.payment_intent
        : dispute.payment_intent?.id

    if (!paymentIntentId) {
        console.log('Dispute: No payment_intent on dispute')
        return
    }

    const { data: payment } = await supabase
        .from('payments')
        .select('id')
        .eq('stripe_payment_id', paymentIntentId)
        .single()

    if (payment) {
        await supabase
            .from('payments')
            .update({
                status: 'disputed',
                dispute_status: dispute.status,
                dispute_id: dispute.id
            })
            .eq('id', payment.id)

        console.log(`Dispute: Marked payment ${payment.id} as disputed`)
    }
}

/**
 * Handle a Stripe dispute closed event.
 * If lost, treats it like a refund.
 */
export async function handleDisputeClosed(dispute: Stripe.Dispute): Promise<void> {
    const supabase = createAdminClient()

    const { data: payment } = await supabase
        .from('payments')
        .select('id, amount')
        .eq('dispute_id', dispute.id)
        .single()

    if (!payment) {
        console.log('Dispute: Payment not found for dispute', dispute.id)
        return
    }

    // Update dispute status
    await supabase
        .from('payments')
        .update({
            dispute_status: dispute.status,
            status: dispute.status === 'lost' ? 'refunded' : 'succeeded'
        })
        .eq('id', payment.id)

    // If the dispute was lost, treat it like a refund
    if (dispute.status === 'lost') {
        console.log(`Dispute: Lost dispute for payment ${payment.id}, processing as refund`)

        // Create a mock charge object for the refund handler
        await handleRefund({
            payment_intent: typeof dispute.payment_intent === 'string'
                ? dispute.payment_intent
                : dispute.payment_intent?.id || '',
            amount_refunded: dispute.amount
        } as Stripe.Charge)
    } else {
        console.log(`Dispute: Won dispute for payment ${payment.id}`)
    }
}

/**
 * Create a notification for a chargeback.
 */
async function createChargebackNotification(
    supabase: ReturnType<typeof createAdminClient>,
    userId: string,
    clientName: string,
    amount: number
): Promise<void> {
    try {
        await supabase
            .from('feature_notifications')
            .insert({
                user_id: userId,
                type: 'chargeback',
                category: 'commission',
                message: `Chargeback: ${clientName}'s payment was reversed (-$${amount.toFixed(2)})`,
                amount: -amount,
                is_read: false
            })
    } catch (error) {
        console.error('Failed to create chargeback notification:', error)
    }
}
