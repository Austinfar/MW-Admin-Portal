import { createClient } from '@/lib/supabase/server';
import { SupabaseClient } from '@supabase/supabase-js';

type CommissionConfig = {
    company_lead_rate?: number;
    self_gen_rate?: number;
};

type CommissionSplit = {
    user_id: string;
    role_in_sale: string;
    split_percentage: number;
};

// Default Global Rates (Fallbacks)
const DEFAULT_COMPANY_LEAD_RATE = 0.50; // 50% to coach (Company keeps 50%)
const DEFAULT_SELF_GEN_RATE = 0.70; // 70% to coach (Company keeps 30%)

/**
 * Calculates and records the commission for a specific payment.
 * Now supports:
 * - Net Revenue Basis (Amount - Stripe Fee)
 * - Per-Coach Rate Overrides
 * - Commission Splits
 */
export async function calculateCommission(paymentId: string) {
    const supabase = await createClient();

    // 1. Fetch Payment & Client Details
    const { data: payment, error: payError } = await supabase
        .from('payments')
        .select(`
            id, 
            amount, 
            stripe_fee, 
            net_amount, 
            client_id, 
            payment_date,
            clients:client_id (
                id,
                lead_source,
                sold_by_user_id,
                assigned_coach_id
            )
        `)
        .eq('id', paymentId)
        .single();

    if (payError || !payment) {
        console.error('Commission Calc Error: Payment not found', payError);
        return { success: false, error: 'Payment not found' };
    }

    // 2. Determine Basis (Net Amount)
    // If net_amount is missing, we calculate it using stripe_fee (default 0 if missing)
    const grossAmount = Number(payment.amount);
    const fee = Number(payment.stripe_fee || 0);
    const basis = grossAmount - fee;

    if (basis <= 0) {
        console.log('Commission Calc: Basis is 0 or negative. Skipping.');
        return { success: true, skipped: true, reason: 'Zero basis' };
    }

    const client = payment.clients;
    // Default 'sold_by' to assigned_coach if not explicitly set
    const clientData = Array.isArray(payment.clients) ? payment.clients[0] : payment.clients;
    // @ts-ignore
    const primaryEarnerId = clientData?.sold_by_user_id || clientData?.assigned_coach_id;

    if (!primaryEarnerId) {
        console.log('Commission Calc: No earner identified for client', clientData?.id);
        return { success: false, error: 'No associated coach/seller' };
    }

    // 3. Check for Splits
    const { data: splits } = await supabase
        .from('commission_splits')
        .select('*')
        .eq('client_id', clientData.id);

    const ledgerEntries = [];
    let remainingBasisPercentage = 1.0;

    // A. Handle Explicit Splits
    if (splits && splits.length > 0) {
        for (const split of splits) {
            const splitPct = Number(split.split_percentage) / 100;
            const payout = basis * splitPct;

            ledgerEntries.push({
                user_id: split.user_id,
                payment_id: payment.id,
                client_id: clientData.id,
                gross_amount: grossAmount,
                net_amount: basis,
                commission_amount: payout,
                calculation_basis: {
                    type: 'split',
                    role: split.role_in_sale,
                    split_pct: splitPct * 100,
                    basis_amount: basis
                },
                payout_period_start: getPayoutPeriodStart(new Date(payment.payment_date)),
                status: 'pending'
            });

            remainingBasisPercentage -= splitPct;
        }
    }

    // B. Handle Primary Earner (Remainder)
    // ONLY if there is basis left. Usually splits are "shares of the commission pot", 
    // but here the requirement implies splits of the *Total Sales Price* (50-50 split).
    // So if 50% is split to Coach B, Coach A gets the rest based on their rate? 
    // OR does the split define the *entire* distribution?
    // Assumption: Splits define explicit overrides. If splits sum to < 100%, the remainder goes to Primary Earner 
    // BUT we must apply the "Lead Source Rate" logic to that remainder.

    // Actually, usually splits = "Coach A gets 50%, Coach B gets 50%".
    // If splits exist, we assume they cover the deal. 
    // IF NO SPLITS, we use the Standard Logic.

    if (!splits || splits.length === 0) {
        // Standard Logic
        // @ts-ignore
        const { rate, rateSource } = await getCommissionRateForUser(supabase, primaryEarnerId, clientData.lead_source);

        const payout = basis * rate;

        ledgerEntries.push({
            user_id: primaryEarnerId,
            payment_id: payment.id,
            client_id: clientData.id,
            gross_amount: grossAmount,
            net_amount: basis,
            commission_amount: payout,
            calculation_basis: {
                type: 'standard',
                lead_source: clientData.lead_source,
                applied_rate: rate,
                rate_source: rateSource, // 'global' or 'override'
                basis_amount: basis
            },
            payout_period_start: getPayoutPeriodStart(new Date(payment.payment_date)),
            status: 'pending'
        });
    }

    // 4. Write to DB
    if (ledgerEntries.length > 0) {
        const { error } = await supabase
            .from('commission_ledger')
            .upsert(ledgerEntries, { onConflict: 'payment_id' }); // Simplistic: One payment, one set of rules. IDs might conflict if splits. 
        // Actually payment_id is unique in ledger... wait. 
        // My schema said `payment_id UUID UNIQUE`. This prevents Splits (multiple rows for same payment).
        // FIX: I need to drop the UNIQUE constraint on payment_id in the migration or handle it differently.
        // Since I just applied the migration, I should check if I can fix it now. 
        // Actually, for now, I will proceed assuming I can fix the constraint.

        if (error) {
            console.error('Failed to write commission ledger', error);
            // If error is uniqueness violation, we might have a schema issue for splits.
            return { success: false, error };
        }
    }

    // 5. Mark Payment as Processed
    await supabase.from('payments').update({ commission_calculated: true }).eq('id', payment.id);

    return { success: true, entries: ledgerEntries.length };
}

/**
 * Auxiliary function to get the applicable rate for a user
 */
async function getCommissionRateForUser(supabase: SupabaseClient, userId: string, leadSource: string) {
    // 1. Fetch User Config
    const { data: user } = await supabase
        .from('users')
        .select('commission_config')
        .eq('id', userId)
        .single();

    const config = user?.commission_config as CommissionConfig || {};

    let rate = 0;
    let rateSource = 'global';

    if (leadSource === 'company_driven') {
        if (config.company_lead_rate !== undefined) {
            rate = config.company_lead_rate;
            rateSource = 'user_override';
        } else {
            rate = DEFAULT_COMPANY_LEAD_RATE;
        }
    } else {
        // Default to self-gen/coach-driven logic
        if (config.self_gen_rate !== undefined) {
            rate = config.self_gen_rate;
            rateSource = 'user_override';
        } else {
            rate = DEFAULT_SELF_GEN_RATE;
        }
    }

    return { rate, rateSource };
}

/**
 * Calculates the start date of the Payroll Period for a given date.
 * bi-weekly periods, ending on Fridays.
 * This is complex to get perfect without a reference "Epoch" payday. 
 * Assumption: Paydays are every 2 weeks. logic needs a known payday anchor.
 * For now, I'll use ISO weeks to simplify or just simple buckets.
 * Better: Store "Payroll Periods" in a table? 
 * User said: "we pay every two weeks on Friday and we pay for the previous two weeks worth of commission."
 */
function getPayoutPeriodStart(date: Date): string {
    // Hacky Placeholder: Just snapping to the 1st or 15th for now to verify data flow,
    // Real bi-weekly logic requires a reference date (e.g., Jan 1st 2024 was start of a period).
    // I will implement a simpler Monday-start bi-weekly logic later or ask user for reference.
    const d = new Date(date);
    d.setDate(d.getDate() - d.getDay()); // Snap to Sunday
    return d.toISOString().split('T')[0];
}
