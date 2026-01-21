import { createAdminClient } from '@/lib/supabase/admin'

interface CommissionSplit {
    userId: string
    role: 'Closer' | 'Referrer' | string
    percentage: number
}

interface LedgerEntry {
    user_id: string
    client_id: string
    payment_id: string
    gross_amount: number
    net_amount: number
    commission_amount: number
    entry_type: 'commission' | 'split'
    split_role: string | null
    split_percentage: number
    source_schedule_id: string | null
    status: 'pending'
    payout_period_start: string
    calculation_basis: Record<string, unknown>
}

/**
 * Calculate and record commissions for a payment.
 *
 * Commission Order (deducted from pool in this order):
 * 1. Stripe fees - deducted first
 * 2. Sales Closer: 10% of GROSS (if in commission_splits)
 * 3. Appointment Setter: 10% of GROSS (if client has appointment_setter_id)
 * 4. Referrer: $100 flat (if in commission_splits, first payment only)
 * 5. Assigned Coach: 50-70% of REMAINDER (what's left after fees + other commissions)
 *
 * ATOMIC LOCKING: Uses database-level locking to prevent race conditions
 * when multiple webhooks arrive simultaneously.
 */
export async function calculateCommission(paymentId: string): Promise<{ success: boolean; skipped?: boolean; reason?: string }> {
    const supabase = createAdminClient()

    // 1. ATOMIC LOCK: Prevent duplicate processing via database-level lock
    // This atomically checks AND sets commission_calculated = true
    const { data: locked, error: lockError } = await supabase.rpc('lock_payment_for_commission', {
        p_payment_id: paymentId
    })

    if (lockError) {
        console.error('Commission Calc: Lock acquisition failed', lockError)
        return { success: false, reason: 'lock_failed' }
    }

    if (!locked) {
        console.log('Commission Calc: Already calculated/locked for payment', paymentId)
        return { success: true, skipped: true, reason: 'already_calculated' }
    }

    // 2. Fetch Payment with Client details
    const { data: payment, error: paymentError } = await supabase
        .from('payments')
        .select(`
            *,
            client:clients (
                id,
                name,
                start_date,
                lead_source,
                is_resign,
                assigned_coach_id,
                appointment_setter_id,
                coach_history
            )
        `)
        .eq('id', paymentId)
        .single()

    if (paymentError || !payment) {
        console.error('Commission Calc: Payment not found', paymentError)
        // Unlock since we couldn't process
        await supabase.rpc('unlock_payment_for_commission', { p_payment_id: paymentId })
        return { success: false, reason: 'payment_not_found' }
    }

    const client = payment.client
    if (!client) {
        // Mark payment for review if no client matched
        await supabase
            .from('payments')
            .update({
                review_status: 'pending_review',
                review_flagged_at: new Date().toISOString()
            })
            .eq('id', paymentId)

        // Create admin notification for orphan payment
        await supabase.from('feature_notifications').insert({
            type: 'orphan_payment',
            category: 'alert',
            message: `Unmatched payment: $${payment.amount} from ${payment.client_email || 'unknown'} - needs manual review`,
            target_role: 'admin',
            is_read: false
        })

        console.log('Commission Calc: No client found, marked for review with admin notification')
        // Unlock since no commission was created
        await supabase.rpc('unlock_payment_for_commission', { p_payment_id: paymentId })
        return { success: false, reason: 'no_client_matched' }
    }

    // 2. Find the Payment Schedule to get commission_splits
    const { data: schedule } = await supabase
        .from('payment_schedules')
        .select('id, commission_splits, assigned_coach_id, program_term')
        .eq('client_id', client.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

    // 3. Fetch Commission Settings
    const { data: settings } = await supabase
        .from('commission_settings')
        .select('setting_key, setting_value')

    const getRate = (key: string, defaultValue = 0): number => {
        const setting = settings?.find(s => s.setting_key === key)
        return setting ? Number(setting.setting_value) : defaultValue
    }

    // 4. Calculate base amounts
    const grossAmount = Number(payment.amount)
    const stripeFee = Number(payment.stripe_fee) || 0
    const afterFees = grossAmount - stripeFee

    if (afterFees <= 0) {
        console.log('Commission Calc: Amount after fees <= 0, skipping')
        return { success: true, skipped: true, reason: 'amount_after_fees_zero' }
    }

    const periodStart = getPayoutPeriodStart(new Date(payment.created_at || payment.created))
    const ledgerEntries: LedgerEntry[] = []

    // Track deductions from the pool for coach calculation
    let totalOtherCommissions = 0

    // 5. Process Commission Splits from Payment Schedule (Closer, Referrer)
    const splits: CommissionSplit[] = (schedule?.commission_splits as CommissionSplit[]) || []
    const closerRate = getRate('closer_rate', 0.10)
    const referrerFlatFee = getRate('referrer_flat_fee', 100)

    for (const split of splits) {
        if (!split.userId || split.userId === 'none') continue

        if (split.role === 'Closer') {
            // Closer: 10% of GROSS on all payments
            const closerCommission = grossAmount * closerRate
            totalOtherCommissions += closerCommission

            ledgerEntries.push({
                user_id: split.userId,
                client_id: client.id,
                payment_id: payment.id,
                gross_amount: grossAmount,
                net_amount: afterFees,
                commission_amount: closerCommission,
                entry_type: 'split',
                split_role: 'closer',
                split_percentage: closerRate * 100,
                source_schedule_id: schedule?.id || null,
                status: 'pending',
                payout_period_start: periodStart,
                calculation_basis: {
                    type: 'closer',
                    rate: closerRate,
                    basis: 'gross'
                }
            })
        } else if (split.role === 'Referrer') {
            // Referrer: $100 flat on FIRST payment only
            const isFirstPayment = await checkIsFirstPayment(supabase, client.id, schedule?.id)

            if (isFirstPayment) {
                totalOtherCommissions += referrerFlatFee

                ledgerEntries.push({
                    user_id: split.userId,
                    client_id: client.id,
                    payment_id: payment.id,
                    gross_amount: grossAmount,
                    net_amount: afterFees,
                    commission_amount: referrerFlatFee,
                    entry_type: 'split',
                    split_role: 'referrer',
                    split_percentage: 0, // Flat fee, not percentage
                    source_schedule_id: schedule?.id || null,
                    status: 'pending',
                    payout_period_start: periodStart,
                    calculation_basis: {
                        type: 'referrer',
                        flat_fee: referrerFlatFee,
                        basis: 'flat',
                        is_first_payment: true
                    }
                })
            }
        }
    }

    // 6. Appointment Setter Commission (10% of GROSS on all payments)
    if (client.appointment_setter_id) {
        const setterRate = getRate('setter_rate', 0.10)
        const setterCommission = grossAmount * setterRate
        totalOtherCommissions += setterCommission

        ledgerEntries.push({
            user_id: client.appointment_setter_id,
            client_id: client.id,
            payment_id: payment.id,
            gross_amount: grossAmount,
            net_amount: afterFees,
            commission_amount: setterCommission,
            entry_type: 'split',
            split_role: 'setter',
            split_percentage: setterRate * 100,
            source_schedule_id: schedule?.id || null,
            status: 'pending',
            payout_period_start: periodStart,
            calculation_basis: {
                type: 'setter',
                rate: setterRate,
                basis: 'gross'
            }
        })
    }

    // 7. Calculate Coach Commission (on REMAINDER after fees and other commissions)
    const coachId = getActiveCoachForPayment(client, payment)

    if (coachId) {
        const coachRate = await getCoachCommissionRate(supabase, coachId, client, settings)

        if (coachRate > 0) {
            // Coach gets percentage of what remains after Stripe fees AND other commissions
            const remainderForCoach = afterFees - totalOtherCommissions
            const coachCommission = remainderForCoach * coachRate

            if (coachCommission > 0) {
                ledgerEntries.push({
                    user_id: coachId,
                    client_id: client.id,
                    payment_id: payment.id,
                    gross_amount: grossAmount,
                    net_amount: remainderForCoach, // This is the basis for coach calculation
                    commission_amount: coachCommission,
                    entry_type: 'commission',
                    split_role: 'coach',
                    split_percentage: coachRate * 100,
                    source_schedule_id: schedule?.id || null,
                    status: 'pending',
                    payout_period_start: periodStart,
                    calculation_basis: {
                        type: 'coach',
                        rate: coachRate,
                        basis: 'remainder',
                        lead_source: client.lead_source,
                        is_resign: client.is_resign,
                        stripe_fee: stripeFee,
                        other_commissions: totalOtherCommissions,
                        remainder_amount: remainderForCoach
                    }
                })
            }
        }
    }

    // 9. Insert all ledger entries
    if (ledgerEntries.length > 0) {
        const { error: insertError } = await supabase
            .from('commission_ledger')
            .upsert(ledgerEntries, {
                onConflict: 'user_id,payment_id',
                ignoreDuplicates: false
            })

        if (insertError) {
            console.error('Commission Calc: Failed to insert ledger entries', insertError)
            // Unlock the payment so it can be retried
            await supabase.rpc('unlock_payment_for_commission', { p_payment_id: paymentId })
            return { success: false, reason: 'ledger_insert_failed' }
        }

        console.log(`Commission Calc: Created ${ledgerEntries.length} ledger entries for payment ${paymentId}`)

        // 10. Create notifications for each recipient
        for (const entry of ledgerEntries) {
            await createCommissionNotification(supabase, entry, client)
        }
    }

    // Note: commission_calculated is already set to true by lock_payment_for_commission
    console.log(`Commission Calc: Successfully processed payment ${paymentId}`)
    return { success: true }
}

/**
 * Determine which coach should receive commission based on coach_history and payment date.
 * Handles coach transitions - payments go to whoever was active at payment time.
 *
 * BOUNDARY LOGIC: Uses INCLUSIVE start, EXCLUSIVE end dates.
 * If coach A ends Jan 15 and coach B starts Jan 15, payment on Jan 15 goes to coach B.
 * Sorted by start_date descending (most recent first) for deterministic behavior.
 */
function getActiveCoachForPayment(
    client: { assigned_coach_id: string | null; coach_history?: Array<{ coach_id: string; start_date: string; end_date: string | null }> },
    payment: { created_at?: string; created?: string }
): string | null {
    const paymentDate = new Date(payment.created_at || payment.created || new Date())
    const coachHistory = client.coach_history || []

    // Sort by start_date descending - most recent first for deterministic behavior
    const sortedHistory = [...coachHistory].sort((a, b) =>
        new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
    )

    // Check history for the coach active at payment time
    for (const entry of sortedHistory) {
        const startDate = new Date(entry.start_date)
        const endDate = entry.end_date ? new Date(entry.end_date) : null

        // INCLUSIVE start, EXCLUSIVE end (paymentDate < endDate, not <=)
        if (paymentDate >= startDate && (!endDate || paymentDate < endDate)) {
            return entry.coach_id
        }
    }

    // Fall back to current assigned coach
    return client.assigned_coach_id
}

/**
 * Get the commission rate for a coach based on their overrides or default rates.
 */
async function getCoachCommissionRate(
    supabase: ReturnType<typeof createAdminClient>,
    coachId: string,
    client: { lead_source: string | null; is_resign: boolean; start_date: string },
    settings: Array<{ setting_key: string; setting_value: number }> | null
): Promise<number> {
    const getRate = (key: string, defaultValue = 0): number => {
        const setting = settings?.find(s => s.setting_key === key)
        return setting ? Number(setting.setting_value) : defaultValue
    }

    // Check for coach-specific override
    const { data: coach } = await supabase
        .from('users')
        .select('commission_rate, commission_config')
        .eq('id', coachId)
        .single()

    if (coach?.commission_rate !== null && coach?.commission_rate !== undefined) {
        return Number(coach.commission_rate)
    }

    // Check commission_config overrides
    const config = coach?.commission_config as { company_lead_rate?: number; self_gen_rate?: number } | null
    if (config) {
        if (client.lead_source === 'company_driven' && config.company_lead_rate) {
            return config.company_lead_rate
        }
        if (client.lead_source === 'coach_driven' && config.self_gen_rate) {
            return config.self_gen_rate
        }
    }

    // Apply default rates based on client status
    if (client.is_resign) {
        return getRate('commission_rate_resign', 0.70)
    }

    // Check if within initial 6-month term
    const startDate = new Date(client.start_date)
    const sixMonthsLater = new Date(startDate)
    sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6)

    if (new Date() > sixMonthsLater) {
        // Past 6 months and not a resign - no commission
        return 0
    }

    // Within 6 months - rate depends on lead source
    if (client.lead_source === 'company_driven') {
        return getRate('commission_rate_company_lead', 0.50)
    }

    return getRate('commission_rate_coach_lead', 0.70)
}

/**
 * Check if this is the first payment for a client/schedule.
 *
 * ATOMIC: Uses PostgreSQL advisory lock to prevent race conditions
 * when multiple payments process simultaneously for a new client.
 */
async function checkIsFirstPayment(
    supabase: ReturnType<typeof createAdminClient>,
    clientId: string,
    _scheduleId: string | null | undefined // Reserved for future per-schedule tracking
): Promise<boolean> {
    // Use atomic advisory lock to prevent race condition with simultaneous payments
    const { data: isFirst, error } = await supabase.rpc('check_is_first_payment', {
        p_client_id: clientId
    })

    if (error) {
        console.error('checkIsFirstPayment: RPC failed, falling back to query', error)
        // Fallback to simple query (less safe but better than failing)
        const { count } = await supabase
            .from('commission_ledger')
            .select('id', { count: 'exact', head: true })
            .eq('client_id', clientId)
            .neq('status', 'void') // Exclude voided entries
        return (count || 0) === 0
    }

    return isFirst ?? false
}

/**
 * Create a notification for commission earned.
 */
async function createCommissionNotification(
    supabase: ReturnType<typeof createAdminClient>,
    entry: LedgerEntry,
    client: { id: string }
): Promise<void> {
    try {
        // Get client name for the notification message
        const { data: clientData } = await supabase
            .from('clients')
            .select('name')
            .eq('id', client.id)
            .single()

        const clientName = clientData?.name || 'a client'
        const amount = entry.commission_amount.toFixed(2)
        const roleLabel = entry.split_role === 'coach' ? 'coaching' :
            entry.split_role === 'closer' ? 'closing' :
            entry.split_role === 'setter' ? 'setting' :
            entry.split_role === 'referrer' ? 'referral' : 'commission'

        await supabase
            .from('feature_notifications')
            .insert({
                user_id: entry.user_id,
                type: 'commission_earned',
                category: 'commission',
                message: `You earned $${amount} from ${clientName}'s payment (${roleLabel})`,
                commission_ledger_id: null, // We'd need to get the inserted ID
                amount: entry.commission_amount,
                is_read: false
            })
    } catch (error) {
        // Don't fail the commission calculation if notification fails
        console.error('Failed to create commission notification:', error)
    }
}

/**
 * Calculate bi-weekly payout period start date.
 * Periods run Monday-Sunday, anchored to Monday Dec 16, 2024.
 */
function getPayoutPeriodStart(date: Date): string {
    // Anchor: Monday Dec 16, 2024
    const anchor = new Date('2024-12-16T00:00:00Z')
    const diffTime = date.getTime() - anchor.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    const periodIndex = Math.floor(diffDays / 14)

    const periodStart = new Date(anchor)
    periodStart.setDate(anchor.getDate() + (periodIndex * 14))

    return periodStart.toISOString().split('T')[0]
}

/**
 * Calculate the payout date (Friday after period ends).
 */
export function getPayoutDate(periodStart: Date): Date {
    const periodEnd = new Date(periodStart)
    periodEnd.setDate(periodEnd.getDate() + 13) // Period is 14 days (Mon-Sun)

    // Find the next Friday after period end
    const payoutDate = new Date(periodEnd)
    const dayOfWeek = payoutDate.getDay()
    const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7 // 5 = Friday
    payoutDate.setDate(payoutDate.getDate() + daysUntilFriday)

    return payoutDate
}

/**
 * Get the current pay period.
 */
export function getCurrentPayPeriod(): { start: Date; end: Date; payoutDate: Date } {
    const now = new Date()
    const periodStartStr = getPayoutPeriodStart(now)
    const start = new Date(periodStartStr)
    const end = new Date(start)
    end.setDate(end.getDate() + 13)
    const payoutDate = getPayoutDate(start)

    return { start, end, payoutDate }
}

/**
 * Recalculate commission for a payment.
 * This voids existing commission entries and re-runs the calculation.
 *
 * Use cases:
 * - Admin needs to correct a miscalculated commission
 * - Client data was updated after initial calculation
 * - Manual matching of orphan payment to client
 *
 * @param paymentId - The payment ID to recalculate
 * @param userId - The user performing the recalculation (for audit log)
 * @param reason - Why the recalculation is being performed
 */
export async function recalculateCommission(
    paymentId: string,
    userId: string,
    reason: string
): Promise<{ success: boolean; voided: number; error?: string }> {
    const supabase = createAdminClient()

    try {
        // 1. Void existing commission entries for this payment
        const { data: voidedCount, error: voidError } = await supabase.rpc('void_commission_entries', {
            p_payment_id: paymentId
        })

        if (voidError) {
            console.error('Recalculate: Failed to void entries', voidError)
            return { success: false, voided: 0, error: 'Failed to void existing entries' }
        }

        console.log(`Recalculate: Voided ${voidedCount || 0} existing entries for payment ${paymentId}`)

        // 2. Unlock the payment so it can be recalculated
        const { error: unlockError } = await supabase.rpc('unlock_payment_for_commission', {
            p_payment_id: paymentId
        })

        if (unlockError) {
            console.error('Recalculate: Failed to unlock payment', unlockError)
            return { success: false, voided: voidedCount || 0, error: 'Failed to unlock payment' }
        }

        // 3. Log the recalculation for audit trail
        await supabase.from('activity_logs').insert({
            action: 'commission_recalculate',
            entity_type: 'payment',
            entity_id: paymentId,
            user_id: userId,
            metadata: {
                reason,
                voided_entries: voidedCount || 0,
                timestamp: new Date().toISOString()
            }
        })

        // 4. Re-run commission calculation
        const result = await calculateCommission(paymentId)

        if (!result.success) {
            return { success: false, voided: voidedCount || 0, error: result.reason }
        }

        console.log(`Recalculate: Successfully recalculated commission for payment ${paymentId}`)
        return { success: true, voided: voidedCount || 0 }

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        console.error('Recalculate: Unexpected error', error)
        return { success: false, voided: 0, error: message }
    }
}

/**
 * Calculate commission for an orphan payment after manual client matching.
 * This is called when an admin matches an unmatched payment to a client.
 *
 * @param paymentId - The payment ID that was matched
 * @param clientId - The client ID it was matched to
 * @param userId - The user performing the match (for audit log)
 */
export async function calculateCommissionAfterMatch(
    paymentId: string,
    clientId: string,
    userId: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = createAdminClient()

    try {
        // 1. Update the payment with the client ID
        const { error: updateError } = await supabase
            .from('payments')
            .update({
                client_id: clientId,
                review_status: 'matched',
                matched_by: userId,
                matched_at: new Date().toISOString()
            })
            .eq('id', paymentId)

        if (updateError) {
            console.error('CalculateAfterMatch: Failed to update payment', updateError)
            return { success: false, error: 'Failed to link payment to client' }
        }

        // 2. Unlock if previously locked (in case of retry)
        await supabase.rpc('unlock_payment_for_commission', { p_payment_id: paymentId })

        // 3. Log the match for audit trail
        await supabase.from('activity_logs').insert({
            action: 'payment_manual_match',
            entity_type: 'payment',
            entity_id: paymentId,
            user_id: userId,
            metadata: {
                client_id: clientId,
                timestamp: new Date().toISOString()
            }
        })

        // 4. Calculate commission
        const result = await calculateCommission(paymentId)

        if (!result.success && result.reason !== 'already_calculated') {
            return { success: false, error: result.reason }
        }

        console.log(`CalculateAfterMatch: Successfully processed payment ${paymentId} for client ${clientId}`)
        return { success: true }

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        console.error('CalculateAfterMatch: Unexpected error', error)
        return { success: false, error: message }
    }
}
