import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

/**
 * Backfill script to update existing payments with actual Stripe fees
 *
 * This script fetches the real Stripe fee from the balance_transaction
 * for each payment and updates the database accordingly.
 *
 * Run with: npx tsx scripts/backfill-stripe-fees.ts
 */

config({ path: resolve(process.cwd(), '.env.local') });

const stripeKey = process.env.STRIPE_SECRET_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!stripeKey || !supabaseUrl || !supabaseKey) {
    console.error('Missing required environment variables:');
    if (!stripeKey) console.error('  - STRIPE_SECRET_KEY');
    if (!supabaseUrl) console.error('  - NEXT_PUBLIC_SUPABASE_URL');
    if (!supabaseKey) console.error('  - SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const stripe = new Stripe(stripeKey);
const supabase = createClient(supabaseUrl, supabaseKey);

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface BackfillStats {
    total: number;
    updated: number;
    skipped: number;
    notFound: number;
    errors: number;
}

const stats: BackfillStats = {
    total: 0,
    updated: 0,
    skipped: 0,
    notFound: 0,
    errors: 0
};

/**
 * Fetch actual Stripe fee for a payment intent
 */
async function getActualStripeFee(stripePaymentId: string): Promise<{ fee: number; netAmount: number } | null> {
    try {
        // Handle both PaymentIntent IDs (pi_xxx) and Charge IDs (ch_xxx)
        if (stripePaymentId.startsWith('pi_')) {
            const paymentIntent = await stripe.paymentIntents.retrieve(stripePaymentId, {
                expand: ['latest_charge.balance_transaction']
            });

            const charge = paymentIntent.latest_charge as Stripe.Charge | null;
            if (charge) {
                const balanceTransaction = charge.balance_transaction as Stripe.BalanceTransaction | null;
                if (balanceTransaction && typeof balanceTransaction !== 'string') {
                    const fee = balanceTransaction.fee / 100;
                    const netAmount = balanceTransaction.net / 100;
                    return { fee, netAmount };
                }
            }
        } else if (stripePaymentId.startsWith('ch_')) {
            const charge = await stripe.charges.retrieve(stripePaymentId, {
                expand: ['balance_transaction']
            });

            const balanceTransaction = charge.balance_transaction as Stripe.BalanceTransaction | null;
            if (balanceTransaction && typeof balanceTransaction !== 'string') {
                const fee = balanceTransaction.fee / 100;
                const netAmount = balanceTransaction.net / 100;
                return { fee, netAmount };
            }
        } else if (stripePaymentId.startsWith('in_')) {
            // Invoice ID - try to get the associated payment intent or charge
            const invoice = await stripe.invoices.retrieve(stripePaymentId, {
                expand: ['charge.balance_transaction']
            });

            const charge = invoice.charge as Stripe.Charge | null;
            if (charge) {
                const balanceTransaction = charge.balance_transaction as Stripe.BalanceTransaction | null;
                if (balanceTransaction && typeof balanceTransaction !== 'string') {
                    const fee = balanceTransaction.fee / 100;
                    const netAmount = balanceTransaction.net / 100;
                    return { fee, netAmount };
                }
            }
        }

        return null;
    } catch (error: any) {
        if (error.code === 'resource_missing') {
            return null;
        }
        throw error;
    }
}

/**
 * Main backfill function
 */
async function backfillStripeFees() {
    console.log('='.repeat(60));
    console.log('  STRIPE FEES BACKFILL');
    console.log('  Started:', new Date().toISOString());
    console.log('='.repeat(60));

    // Fetch all payments that need fee updates
    // We target payments that either:
    // 1. Have stripe_fee = null or 0
    // 2. Have an estimated fee (we can identify these by checking if net_amount matches amount - estimated_fee)
    const { data: payments, error } = await supabase
        .from('payments')
        .select('id, stripe_payment_id, amount, stripe_fee, net_amount')
        .not('stripe_payment_id', 'is', null)
        .order('created_at', { ascending: false });

    if (error || !payments) {
        console.error('Failed to fetch payments:', error);
        return;
    }

    stats.total = payments.length;
    console.log(`\nFound ${payments.length} payments to process\n`);

    let processed = 0;

    for (const payment of payments) {
        processed++;

        if (!payment.stripe_payment_id) {
            stats.skipped++;
            continue;
        }

        // Check if fee looks like an estimate (2.9% + $0.30)
        const estimatedFee = Number((payment.amount * 0.029 + 0.30).toFixed(2));
        const currentFee = Number(payment.stripe_fee) || 0;
        const isEstimatedFee = currentFee === 0 || Math.abs(currentFee - estimatedFee) < 0.01;

        if (!isEstimatedFee && payment.stripe_fee !== null) {
            // Fee looks real, skip
            stats.skipped++;
            continue;
        }

        try {
            const feeData = await getActualStripeFee(payment.stripe_payment_id);

            if (feeData) {
                const { fee, netAmount } = feeData;

                // Only update if the fee is different
                if (Math.abs(fee - currentFee) > 0.001) {
                    const { error: updateError } = await supabase
                        .from('payments')
                        .update({
                            stripe_fee: fee,
                            net_amount: netAmount
                        })
                        .eq('id', payment.id);

                    if (updateError) {
                        console.error(`  ✗ Error updating payment ${payment.id}:`, updateError.message);
                        stats.errors++;
                    } else {
                        console.log(`  ✓ Updated ${payment.stripe_payment_id}: $${payment.amount} → fee: $${fee.toFixed(2)} (was $${currentFee.toFixed(2)})`);
                        stats.updated++;
                    }
                } else {
                    stats.skipped++;
                }
            } else {
                stats.notFound++;
            }
        } catch (err: any) {
            console.error(`  ✗ Error fetching fee for ${payment.stripe_payment_id}:`, err.message);
            stats.errors++;
        }

        // Rate limit - Stripe allows 100 requests/sec
        await delay(25);

        if (processed % 100 === 0) {
            console.log(`\n  Progress: ${processed}/${stats.total} payments processed`);
            console.log(`  Updated: ${stats.updated}, Skipped: ${stats.skipped}, Not Found: ${stats.notFound}, Errors: ${stats.errors}\n`);
        }
    }

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('  BACKFILL COMPLETE - SUMMARY');
    console.log('='.repeat(60));
    console.log(`
  Total payments processed:  ${stats.total}
  Updated with real fees:    ${stats.updated}
  Skipped (already correct): ${stats.skipped}
  Not found in Stripe:       ${stats.notFound}
  Errors:                    ${stats.errors}

  Finished: ${new Date().toISOString()}
`);
}

// Run the backfill
backfillStripeFees().catch(console.error);
