import { createAdminClient } from '@/lib/supabase/admin'
import { stripe } from '@/lib/stripe'
import { sendGHLSms } from '@/lib/actions/ghl'
import { getAppSettings } from '@/lib/actions/app-settings'

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DEFAULT_CHECKIN_MESSAGE = 'Hey {firstName}! Just checking in - how\'s your week going? Let us know if you need anything!'

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

export async function processWeeklyCheckins() {
    const supabase = createAdminClient()
    const today = new Date()
    const todayDateString = today.toISOString().split('T')[0]
    // Send to clients whose check-in day is TOMORROW (day before their check-in)
    const tomorrowDayIndex = (today.getDay() + 1) % 7
    const tomorrowDayName = DAYS_OF_WEEK[tomorrowDayIndex]

    console.log(`[SMS Check-in] Running for clients with check-in day ${tomorrowDayName} (sending day before)`)

    // Check if feature is enabled and get message template
    const settings = await getAppSettings()
    if (settings['sms_checkin_enabled'] === 'false') {
        console.log('[SMS Check-in] Feature is disabled')
        return { message: 'SMS check-in feature is disabled', sent: 0 }
    }

    const messageTemplate = settings['sms_checkin_message_template'] || DEFAULT_CHECKIN_MESSAGE

    // Find active clients whose check_in_day is tomorrow, valid GHL contact, and started program
    const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('id, name, ghl_contact_id, check_in_day, start_date')
        .eq('status', 'active')
        .eq('check_in_day', tomorrowDayName)
        .not('ghl_contact_id', 'is', null)
        .lt('start_date', today.toISOString())

    if (clientsError) {
        console.error('[SMS Check-in] Error fetching clients:', clientsError)
        return { error: 'Database error', sent: 0 }
    }

    if (!clients || clients.length === 0) {
        return { message: `No clients with check-in day ${tomorrowDayName}`, sent: 0 }
    }

    console.log(`[SMS Check-in] Found ${clients.length} clients with check-in day ${tomorrowDayName}`)

    // Filter out clients who already received SMS today
    const { data: existingLogs } = await supabase
        .from('sms_checkin_logs')
        .select('client_id')
        .gte('sent_at', `${todayDateString}T00:00:00Z`)
        .lt('sent_at', `${todayDateString}T23:59:59Z`)

    const alreadySentIds = new Set(existingLogs?.map(l => l.client_id) || [])
    const eligibleClients = clients.filter(c =>
        !alreadySentIds.has(c.id) &&
        c.ghl_contact_id &&
        !c.ghl_contact_id.startsWith('manual_')
    )

    console.log(`[SMS Check-in] ${eligibleClients.length} clients eligible (${alreadySentIds.size} already sent today)`)

    let sentCount = 0
    let errorCount = 0

    for (const client of eligibleClients) {
        const firstName = client.name.split(' ')[0]
        const personalizedMessage = messageTemplate.replace('{firstName}', firstName)

        // Create log entry first (pending status)
        const { data: logEntry, error: logError } = await supabase
            .from('sms_checkin_logs')
            .insert({
                client_id: client.id,
                ghl_contact_id: client.ghl_contact_id,
                message: personalizedMessage,
                status: 'pending'
            })
            .select('id')
            .single()

        if (logError) {
            // Likely duplicate key error (already sent today)
            console.warn(`[SMS Check-in] Skip duplicate for client ${client.id}:`, logError.message)
            continue
        }

        // Send SMS via GHL
        const result = await sendGHLSms(client.ghl_contact_id, personalizedMessage)

        if (result.error) {
            console.error(`[SMS Check-in] Failed for client ${client.id}:`, result.error)
            await supabase
                .from('sms_checkin_logs')
                .update({ status: 'failed', error_message: result.error })
                .eq('id', logEntry.id)
            errorCount++
        } else {
            await supabase
                .from('sms_checkin_logs')
                .update({ status: 'sent' })
                .eq('id', logEntry.id)
            sentCount++
        }

        // Small delay to avoid rate limiting (100ms between sends)
        await new Promise(resolve => setTimeout(resolve, 100))
    }

    console.log(`[SMS Check-in] Complete. Sent: ${sentCount}, Errors: ${errorCount}`)

    return {
        success: true,
        checkinDay: tomorrowDayName,
        eligible: eligibleClients.length,
        sent: sentCount,
        errors: errorCount
    }
}
