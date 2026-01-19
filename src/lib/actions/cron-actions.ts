import { createAdminClient } from '@/lib/supabase/admin'
import { stripe } from '@/lib/stripe'

export async function processScheduledCharges() {
    const supabase = createAdminClient()

    // 1. Fetch pending charges that are due
    const { data: charges, error } = await supabase
        .from('scheduled_charges')
        .select(`
            id,
            amount,
            schedule_id,
            payment_schedules!inner (
                id,
                stripe_customer_id,
                stripe_payment_method_id,
                plan_name,
                amount,
                stripe_price_id
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
            const scheduleData = charge.payment_schedules
            const schedule = Array.isArray(scheduleData) ? scheduleData[0] : scheduleData

            if (!schedule || !schedule.stripe_customer_id || !schedule.stripe_payment_method_id) {
                // Should be caught by query filter, but safety check
                continue
            }

            // 2b. Calculate Payment Index and Total
            // Need to know position in schedule. 
            // Fetch all charges for this schedule to compare
            const { data: allScheduleCharges } = await supabase
                .from('scheduled_charges')
                .select('id, due_date')
                .eq('schedule_id', schedule.id)
                .order('due_date', { ascending: true })

            // Determine if there was a down payment (amount > 0)
            // If so, all scheduled charges are shifted by +1 index
            const hasDownPayment = (schedule.amount && schedule.amount > 0)
            const downPaymentOffset = hasDownPayment ? 1 : 0

            const totalScheduled = allScheduleCharges?.length || 0
            const totalPayments = totalScheduled + downPaymentOffset

            // Find index of current charge
            const currentChargeIndex = allScheduleCharges?.findIndex(c => c.id === charge.id) ?? -1
            const paymentNumber = currentChargeIndex + 1 + downPaymentOffset

            const paymentDescription = `${schedule.plan_name || 'Payment Plan'}: Payment ${paymentNumber} of ${totalPayments}`

            const paymentIntent = await stripe.paymentIntents.create({
                amount: charge.amount, // already in cents
                currency: 'usd',
                customer: schedule.stripe_customer_id,
                payment_method: schedule.stripe_payment_method_id,
                off_session: true,
                confirm: true,
                description: paymentDescription,
                metadata: {
                    scheduleId: schedule.id,
                    planName: schedule.plan_name,
                    paymentIndex: String(paymentNumber),
                    totalPayments: String(totalPayments),
                    type: 'scheduled_charge',
                    productId: schedule.stripe_price_id || 'custom_split' // Link to product if possible
                }
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
