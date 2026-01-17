'use server'

import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

export async function processScheduledCharges() {
    const supabase = await createClient()

    // 1. Fetch pending charges that are due
    const { data: charges, error } = await supabase
        .from('scheduled_charges')
        .select(`
            id,
            amount,
            schedule_id,
            payment_schedules (
                stripe_customer_id,
                stripe_payment_method_id
            )
        `)
        .eq('status', 'pending')
        .lte('due_date', new Date().toISOString()) // Due now or in past
        .not('payment_schedules.stripe_customer_id', 'is', null) // Must have customer
        .not('payment_schedules.stripe_payment_method_id', 'is', null) // Must have payment method

    if (error) {
        console.error('Error fetching due charges:', error)
        return { error: 'Database error' }
    }

    if (!charges || charges.length === 0) {
        return { message: 'No charges due', count: 0 }
    }

    let successCount = 0
    let failCount = 0

    // 2. Process each charge
    for (const charge of charges) {
        try {
            const schedule = charge.payment_schedules

            if (!schedule || !schedule.stripe_customer_id || !schedule.stripe_payment_method_id) {
                // Should be caught by query filter, but safety check
                continue
            }

            const paymentIntent = await stripe.paymentIntents.create({
                amount: charge.amount, // already in cents
                currency: 'usd',
                customer: schedule.stripe_customer_id,
                payment_method: schedule.stripe_payment_method_id,
                off_session: true,
                confirm: true,
            })

            // Update charge status
            await supabase
                .from('scheduled_charges')
                .update({
                    status: 'paid',
                    stripe_payment_intent_id: paymentIntent.id
                })
                .eq('id', charge.id)

            successCount++

        } catch (idxError) {
            console.error(`Failed to charge ${charge.id}:`, idxError)

            // Optional: Mark as failed or retry later
            // For now, we leave as pending? Or marked failed?
            // marking failed to avoid infinite retry loop in dev
            await supabase
                .from('scheduled_charges')
                .update({ status: 'failed' })
                .eq('id', charge.id)

            failCount++
        }
    }

    return {
        success: true,
        message: `Processed ${charges.length} charges`,
        results: { success: successCount, failed: failCount }
    }
}
