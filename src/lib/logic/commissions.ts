import { createAdminClient } from '@/lib/supabase/admin'

export async function calculateCommission(paymentId: string) {
    const supabase = createAdminClient()

    // 1. Fetch Payment and Client details
    const { data: payment, error: paymentError } = await supabase
        .from('payments')
        .select(`
            *,
            client:clients (
                id,
                start_date,
                lead_source,
                is_resign,
                assigned_coach_id
            )
        `)
        .eq('id', paymentId)
        .single()

    if (paymentError || !payment) {
        console.error('Commission Calc: Payment not found', paymentError)
        return
    }

    const client = payment.client
    if (!client || !client.assigned_coach_id) {
        console.log('Commission Calc: No client or assigned coach, skipping.')
        return
    }

    // 2. Fetch Settings
    const { data: settings } = await supabase
        .from('commission_settings')
        .select('*')

    // Helper to get rate
    const getRate = (key: string) => {
        const s = settings?.find(s => s.setting_key === key)
        return s ? Number(s.setting_value) : 0
    }

    // 3. Determine Rate
    let rate = 0

    // NEW: Check if coach has a specific override rate
    // We need to fetch the coach's profile.
    if (client.assigned_coach_id) {
        const { data: coach } = await supabase
            .from('users')
            .select('commission_rate')
            .eq('id', client.assigned_coach_id)
            .single()

        if (coach && coach.commission_rate !== null && coach.commission_rate !== undefined) {
            rate = Number(coach.commission_rate)
            // If stored as percentage (e.g. 50), convert to decimal (0.50)
            // If stored as decimal (0.50), use as is.
            // Assumption: Stored as decimal based on 'commission_rate' naming.
            // Let's assume standard decimal (0.50 = 50%).
            console.log(`Commission Calc: Using coach specific rate: ${rate}`)

            // If we found a specific rate, we skip the default logic?
            // "if a user has a specific commission set up, use that." -> Yes.

            // However, maybe re-sign logic still applies? 
            // "Default commission should follow the general commission structure; if a user has a specific commission set up, use that."
            // Usually specific overrides EVERYTHING.
        }
    }

    // Only calculate default if no specific rate was found (rate is still 0)
    if (rate === 0) {
        // Check if re-sign
        if (client.is_resign) {
            rate = getRate('commission_rate_resign') // e.g. 0.70
        } else {
            // Initial term logic
            // Check date logic? "Initial 6 months".
            // Let's compare payment.created (date) vs client.start_date
            const paymentDate = new Date(payment.created)
            const startDate = new Date(client.start_date)
            const sixMonthsLater = new Date(startDate)
            sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6)

            if (paymentDate > sixMonthsLater) {
                // Post-initial term on a non-resign client? 
                // Spec says: "Initial term" vs "Resign".
                // If they are NOT resign, but past 6 months, maybe they should have resigned?
                // Or maybe it falls back to a different rate?
                // For now, let's assume if they are NOT resign, we treat them as "Initial term" bucket rules OR stop paying?
                // "Commissions are calculated... during the first 6 months... or indefinitely for re-signed".
                // So if NOT re-signed and > 6 months, rate might be 0?
                // Let's log a warning and default to 0 for safety, or just apply resign rate?
                // Let's stick to strict: if not resign and > 6mo, 0.
                rate = 0
                console.log('Commission Calc: Payment past 6 months for non-resign client. Rate = 0.')
            } else {
                // Within 6 months
                if (client.lead_source === 'company_driven') {
                    rate = getRate('commission_rate_company_lead') // 0.50
                } else {
                    // Coach driven (or null default?)
                    rate = getRate('commission_rate_coach_lead') // 0.70
                }
            }
        }
    }

    if (rate === 0) return

    // 4. Calculate Split Amount
    const commissionAmount = Number(payment.amount) * rate

    // 5. Create Split Record
    // Default: 100% to assigned coach. Role = 'primary'

    const { error: splitError } = await supabase
        .from('commission_splits')
        .insert({
            payment_id: payment.id,
            coach_id: client.assigned_coach_id,
            role: 'primary',
            amount: commissionAmount,
            percentage: rate * 100 // Storing the effective rate as percentage (e.g. 50, 70) or split %?
            // Schema comment said "percentage of the pool". 
            // If the pool IS the full commissionAmount, then primary gets 100% of the pool.
            // But here "rate" is the calculation of the pool itself derived from payment.
            // Let's align: 
            // - `amount` = actual dollars.
            // - `percentage` = let's store the COMMISSION RATE used (e.g. 0.5 or 50). 
            // This aids debugging "why did I get $50 on $100? Oh, rate was 50%".
        })

    if (splitError) {
        console.error('Commission Calc: Failed to insert split', splitError)
    }
}
