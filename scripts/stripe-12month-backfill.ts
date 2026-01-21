import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

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

// 12 months ago timestamp
const TWELVE_MONTHS_AGO = Math.floor(Date.now() / 1000) - (365 * 24 * 60 * 60);

interface BackfillStats {
    clientsTotal: number;
    clientsLinked: number;
    paymentIntentsTotal: number;
    paymentIntentsSynced: number;
    chargesTotal: number;
    chargesSynced: number;
    subscriptionsTotal: number;
    subscriptionsSynced: number;
    paymentsLinkedToClient: number;
    paymentsOrphaned: number;
    errors: number;
}

const stats: BackfillStats = {
    clientsTotal: 0,
    clientsLinked: 0,
    paymentIntentsTotal: 0,
    paymentIntentsSynced: 0,
    chargesTotal: 0,
    chargesSynced: 0,
    subscriptionsTotal: 0,
    subscriptionsSynced: 0,
    paymentsLinkedToClient: 0,
    paymentsOrphaned: 0,
    errors: 0
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Calculate estimated Stripe fee (2.9% + $0.30)
 */
function calculateStripeFee(amountInCents: number): number {
    const amountInDollars = amountInCents / 100;
    return Number((amountInDollars * 0.029 + 0.30).toFixed(2));
}

/**
 * Map Stripe payment status to database-allowed status
 */
function mapStripeStatus(stripeStatus: string): string {
    const statusMap: Record<string, string> = {
        'succeeded': 'succeeded',
        'canceled': 'failed',
        'requires_payment_method': 'pending',
        'requires_confirmation': 'pending',
        'requires_action': 'pending',
        'processing': 'pending',
        'requires_capture': 'pending',
        'paid': 'succeeded',
        'failed': 'failed',
        'pending': 'pending'
    };
    return statusMap[stripeStatus] || 'pending';
}

/**
 * Phase 1: Link all clients to their Stripe customer IDs
 */
async function syncClientsWithStripe(): Promise<Map<string, string>> {
    console.log('\n' + '='.repeat(60));
    console.log('PHASE 1: Linking clients to Stripe customers');
    console.log('='.repeat(60));

    const customerToClientMap = new Map<string, string>();

    const { data: clients, error } = await supabase
        .from('clients')
        .select('id, email, name, stripe_customer_id')
        .order('created_at', { ascending: false });

    if (error || !clients) {
        console.error('Failed to fetch clients:', error);
        return customerToClientMap;
    }

    stats.clientsTotal = clients.length;
    console.log(`Found ${clients.length} clients to process\n`);

    let processed = 0;
    for (const client of clients) {
        processed++;

        // If already linked, add to map
        if (client.stripe_customer_id) {
            customerToClientMap.set(client.stripe_customer_id, client.id);
            stats.clientsLinked++;
            continue;
        }

        if (!client.email) {
            continue;
        }

        try {
            const customers = await stripe.customers.list({
                email: client.email,
                limit: 1
            });

            if (customers.data.length > 0) {
                const stripeCustomerId = customers.data[0].id;

                const { error: updateError } = await supabase
                    .from('clients')
                    .update({ stripe_customer_id: stripeCustomerId })
                    .eq('id', client.id);

                if (!updateError) {
                    customerToClientMap.set(stripeCustomerId, client.id);
                    stats.clientsLinked++;
                    console.log(`  ✓ Linked: ${client.name} (${client.email}) -> ${stripeCustomerId}`);
                }
            }
        } catch (err: any) {
            console.error(`  ✗ Error linking ${client.email}:`, err.message);
            stats.errors++;
        }

        await delay(50);

        if (processed % 50 === 0) {
            console.log(`  Progress: ${processed}/${clients.length} clients processed`);
        }
    }

    console.log(`\n✓ Phase 1 complete: ${stats.clientsLinked}/${stats.clientsTotal} clients linked to Stripe`);

    // Build complete map from DB
    const { data: allClients } = await supabase
        .from('clients')
        .select('id, stripe_customer_id')
        .not('stripe_customer_id', 'is', null);

    allClients?.forEach(c => {
        if (c.stripe_customer_id) {
            customerToClientMap.set(c.stripe_customer_id, c.id);
        }
    });

    return customerToClientMap;
}

/**
 * Build email-to-client lookup for fallback matching
 */
async function buildEmailLookup(): Promise<Map<string, string>> {
    const emailToClientMap = new Map<string, string>();

    const { data: clients } = await supabase
        .from('clients')
        .select('id, email')
        .not('email', 'is', null);

    clients?.forEach(client => {
        if (client.email) {
            emailToClientMap.set(client.email.toLowerCase(), client.id);
        }
    });

    console.log(`Built email lookup with ${emailToClientMap.size} entries`);
    return emailToClientMap;
}

/**
 * Phase 2: Import all payment intents from last 12 months
 */
async function importPaymentIntents(
    customerToClientMap: Map<string, string>,
    emailToClientMap: Map<string, string>
): Promise<void> {
    console.log('\n' + '='.repeat(60));
    console.log('PHASE 2: Importing Payment Intents (last 12 months)');
    console.log('='.repeat(60));
    console.log(`Fetching payments since: ${new Date(TWELVE_MONTHS_AGO * 1000).toISOString()}\n`);

    let hasMore = true;
    let startingAfter: string | undefined;
    let pageCount = 0;

    while (hasMore) {
        pageCount++;
        console.log(`Fetching page ${pageCount}...`);

        try {
            const params: Stripe.PaymentIntentListParams = {
                limit: 100,
                created: { gte: TWELVE_MONTHS_AGO },
                expand: ['data.latest_charge']
            };

            if (startingAfter) {
                params.starting_after = startingAfter;
            }

            const paymentIntents = await stripe.paymentIntents.list(params);

            console.log(`  Retrieved ${paymentIntents.data.length} payment intents`);

            for (const payment of paymentIntents.data) {
                stats.paymentIntentsTotal++;

                const stripeCustomerId = typeof payment.customer === 'string'
                    ? payment.customer
                    : (payment.customer as Stripe.Customer)?.id || null;

                // Try to match to client
                let clientId: string | null = null;

                if (stripeCustomerId && customerToClientMap.has(stripeCustomerId)) {
                    clientId = customerToClientMap.get(stripeCustomerId) || null;
                }

                // Fallback: match by email
                if (!clientId) {
                    let email = payment.receipt_email;

                    if (!email && payment.latest_charge) {
                        const charge = payment.latest_charge as Stripe.Charge;
                        email = charge.billing_details?.email || null;
                    }

                    if (email && emailToClientMap.has(email.toLowerCase())) {
                        clientId = emailToClientMap.get(email.toLowerCase()) || null;
                    }
                }

                const stripeFee = calculateStripeFee(payment.amount);
                const netAmount = (payment.amount / 100) - stripeFee;

                let clientEmail = payment.receipt_email;
                if (!clientEmail && payment.latest_charge) {
                    const charge = payment.latest_charge as Stripe.Charge;
                    clientEmail = charge.billing_details?.email || null;
                }

                // Check for refunds
                let refundAmount = 0;
                let status = mapStripeStatus(payment.status);

                if (payment.latest_charge) {
                    const charge = payment.latest_charge as Stripe.Charge;
                    if (charge.refunded) {
                        status = 'refunded';
                        refundAmount = (charge.amount_refunded || 0) / 100;
                    } else if (charge.amount_refunded && charge.amount_refunded > 0) {
                        status = 'partially_refunded';
                        refundAmount = charge.amount_refunded / 100;
                    }
                }

                const { error } = await supabase.from('payments').upsert({
                    stripe_payment_id: payment.id,
                    amount: payment.amount / 100,
                    currency: payment.currency,
                    status: status,
                    payment_date: new Date(payment.created * 1000).toISOString(),
                    client_email: clientEmail,
                    stripe_customer_id: stripeCustomerId,
                    client_id: clientId,
                    product_name: payment.description,
                    stripe_fee: stripeFee,
                    net_amount: netAmount,
                    refund_amount: refundAmount > 0 ? refundAmount : null,
                    review_status: clientId ? null : 'pending_review'
                }, {
                    onConflict: 'stripe_payment_id'
                });

                if (error) {
                    console.error(`  ✗ Error upserting ${payment.id}:`, error.message);
                    stats.errors++;
                } else {
                    stats.paymentIntentsSynced++;
                    if (clientId) {
                        stats.paymentsLinkedToClient++;
                    } else {
                        stats.paymentsOrphaned++;
                    }
                }
            }

            hasMore = paymentIntents.has_more;
            if (hasMore && paymentIntents.data.length > 0) {
                startingAfter = paymentIntents.data[paymentIntents.data.length - 1].id;
            }

            await delay(100);

        } catch (err: any) {
            console.error(`  ✗ Error fetching page ${pageCount}:`, err.message);
            stats.errors++;
            hasMore = false;
        }
    }

    console.log(`\n✓ Phase 2 complete: ${stats.paymentIntentsSynced}/${stats.paymentIntentsTotal} payment intents synced`);
}

/**
 * Phase 3: Import standalone charges (charges without payment intents)
 */
async function importStandaloneCharges(
    customerToClientMap: Map<string, string>,
    emailToClientMap: Map<string, string>
): Promise<void> {
    console.log('\n' + '='.repeat(60));
    console.log('PHASE 3: Importing Standalone Charges (last 12 months)');
    console.log('='.repeat(60));

    let hasMore = true;
    let startingAfter: string | undefined;
    let pageCount = 0;

    while (hasMore) {
        pageCount++;
        console.log(`Fetching charge page ${pageCount}...`);

        try {
            const params: Stripe.ChargeListParams = {
                limit: 100,
                created: { gte: TWELVE_MONTHS_AGO }
            };

            if (startingAfter) {
                params.starting_after = startingAfter;
            }

            const charges = await stripe.charges.list(params);

            console.log(`  Retrieved ${charges.data.length} charges`);

            for (const charge of charges.data) {
                // Skip charges that have a payment intent (already imported)
                if (charge.payment_intent) {
                    continue;
                }

                stats.chargesTotal++;

                const stripeCustomerId = typeof charge.customer === 'string'
                    ? charge.customer
                    : (charge.customer as Stripe.Customer)?.id || null;

                let clientId: string | null = null;

                if (stripeCustomerId && customerToClientMap.has(stripeCustomerId)) {
                    clientId = customerToClientMap.get(stripeCustomerId) || null;
                }

                if (!clientId) {
                    const email = charge.billing_details?.email || charge.receipt_email;
                    if (email && emailToClientMap.has(email.toLowerCase())) {
                        clientId = emailToClientMap.get(email.toLowerCase()) || null;
                    }
                }

                const stripeFee = calculateStripeFee(charge.amount);
                const netAmount = (charge.amount / 100) - stripeFee;

                let status = mapStripeStatus(charge.status);
                let refundAmount = 0;

                if (charge.refunded) {
                    status = 'refunded';
                    refundAmount = (charge.amount_refunded || 0) / 100;
                } else if (charge.amount_refunded && charge.amount_refunded > 0) {
                    status = 'partially_refunded';
                    refundAmount = charge.amount_refunded / 100;
                }

                const { error } = await supabase.from('payments').upsert({
                    stripe_payment_id: charge.id,
                    amount: charge.amount / 100,
                    currency: charge.currency,
                    status: status,
                    payment_date: new Date(charge.created * 1000).toISOString(),
                    client_email: charge.billing_details?.email || charge.receipt_email || null,
                    stripe_customer_id: stripeCustomerId,
                    client_id: clientId,
                    product_name: charge.description,
                    stripe_fee: stripeFee,
                    net_amount: netAmount,
                    refund_amount: refundAmount > 0 ? refundAmount : null,
                    review_status: clientId ? null : 'pending_review'
                }, {
                    onConflict: 'stripe_payment_id'
                });

                if (error) {
                    console.error(`  ✗ Error upserting charge ${charge.id}:`, error.message);
                    stats.errors++;
                } else {
                    stats.chargesSynced++;
                    if (clientId) {
                        stats.paymentsLinkedToClient++;
                    } else {
                        stats.paymentsOrphaned++;
                    }
                }
            }

            hasMore = charges.has_more;
            if (hasMore && charges.data.length > 0) {
                startingAfter = charges.data[charges.data.length - 1].id;
            }

            await delay(100);

        } catch (err: any) {
            console.error(`  ✗ Error fetching charges page ${pageCount}:`, err.message);
            stats.errors++;
            hasMore = false;
        }
    }

    console.log(`\n✓ Phase 3 complete: ${stats.chargesSynced}/${stats.chargesTotal} standalone charges synced`);
}

/**
 * Phase 4: Sync all subscriptions
 */
async function syncSubscriptions(customerToClientMap: Map<string, string>): Promise<void> {
    console.log('\n' + '='.repeat(60));
    console.log('PHASE 4: Syncing Subscriptions');
    console.log('='.repeat(60));

    let hasMore = true;
    let startingAfter: string | undefined;
    let pageCount = 0;

    while (hasMore) {
        pageCount++;
        console.log(`Fetching subscription page ${pageCount}...`);

        try {
            const params: Stripe.SubscriptionListParams = {
                limit: 100,
                status: 'all',
                expand: ['data.customer']
            };

            if (startingAfter) {
                params.starting_after = startingAfter;
            }

            const subscriptions = await stripe.subscriptions.list(params);

            console.log(`  Retrieved ${subscriptions.data.length} subscriptions`);

            for (const sub of subscriptions.data) {
                stats.subscriptionsTotal++;

                const stripeCustomerId = typeof sub.customer === 'string'
                    ? sub.customer
                    : sub.customer.id;

                const clientId = customerToClientMap.get(stripeCustomerId) || null;

                const subAny = sub as any;
                const currentPeriodEnd = subAny.current_period_end
                    ? new Date(subAny.current_period_end * 1000).toISOString()
                    : null;

                const unitAmount = sub.items.data[0]?.price?.unit_amount || 0;

                const { error } = await supabase.from('subscriptions').upsert({
                    stripe_subscription_id: sub.id,
                    stripe_customer_id: stripeCustomerId,
                    status: sub.status,
                    amount: unitAmount / 100,
                    currency: sub.currency,
                    interval: sub.items.data[0]?.price?.recurring?.interval || 'month',
                    current_period_end: currentPeriodEnd,
                    cancel_at_period_end: sub.cancel_at_period_end,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'stripe_subscription_id'
                });

                if (error) {
                    console.error(`  ✗ Error upserting subscription ${sub.id}:`, error.message);
                    stats.errors++;
                } else {
                    stats.subscriptionsSynced++;
                }
            }

            hasMore = subscriptions.has_more;
            if (hasMore && subscriptions.data.length > 0) {
                startingAfter = subscriptions.data[subscriptions.data.length - 1].id;
            }

            await delay(100);

        } catch (err: any) {
            console.error(`  ✗ Error fetching subscriptions page ${pageCount}:`, err.message);
            stats.errors++;
            hasMore = false;
        }
    }

    console.log(`\n✓ Phase 4 complete: ${stats.subscriptionsSynced}/${stats.subscriptionsTotal} subscriptions synced`);
}

/**
 * Phase 5: Flag payments needing commission calculation
 */
async function flagPaymentsForCommission(): Promise<number> {
    console.log('\n' + '='.repeat(60));
    console.log('PHASE 5: Flagging payments for commission calculation');
    console.log('='.repeat(60));

    const { data: uncalculated, error } = await supabase
        .from('payments')
        .select('id, stripe_payment_id, amount, client_id')
        .eq('status', 'succeeded')
        .not('client_id', 'is', null)
        .or('commission_calculated.is.null,commission_calculated.eq.false');

    if (error) {
        console.error('Error fetching uncalculated payments:', error);
        return 0;
    }

    if (!uncalculated || uncalculated.length === 0) {
        console.log('✓ All payments have commissions calculated.');
        return 0;
    }

    console.log(`Found ${uncalculated.length} payments needing commission calculation\n`);

    // Group by month for easier review
    const byMonth: Record<string, number> = {};
    const { data: paymentsWithDate } = await supabase
        .from('payments')
        .select('id, payment_date')
        .in('id', uncalculated.map(p => p.id));

    paymentsWithDate?.forEach(p => {
        const month = p.payment_date?.substring(0, 7) || 'unknown';
        byMonth[month] = (byMonth[month] || 0) + 1;
    });

    console.log('Breakdown by month:');
    Object.entries(byMonth).sort().forEach(([month, count]) => {
        console.log(`  ${month}: ${count} payments`);
    });

    return uncalculated.length;
}

/**
 * Print final summary
 */
function printSummary(): void {
    console.log('\n' + '='.repeat(60));
    console.log('  12-MONTH BACKFILL COMPLETE - SUMMARY');
    console.log('='.repeat(60));
    console.log(`
  Date Range: ${new Date(TWELVE_MONTHS_AGO * 1000).toISOString().split('T')[0]} to ${new Date().toISOString().split('T')[0]}

  Clients:
    Total in database:      ${stats.clientsTotal}
    Linked to Stripe:       ${stats.clientsLinked}

  Payment Intents:
    Retrieved from Stripe:  ${stats.paymentIntentsTotal}
    Successfully synced:    ${stats.paymentIntentsSynced}

  Standalone Charges:
    Retrieved from Stripe:  ${stats.chargesTotal}
    Successfully synced:    ${stats.chargesSynced}

  Subscriptions:
    Retrieved from Stripe:  ${stats.subscriptionsTotal}
    Successfully synced:    ${stats.subscriptionsSynced}

  Payment Matching:
    Linked to clients:      ${stats.paymentsLinkedToClient}
    Orphaned (needs review): ${stats.paymentsOrphaned}

  Errors:                   ${stats.errors}
`);
}

async function main() {
    console.log('='.repeat(60));
    console.log('  STRIPE 12-MONTH PRODUCTION BACKFILL');
    console.log('  Started:', new Date().toISOString());
    console.log('='.repeat(60));

    try {
        // Phase 1: Link clients to Stripe
        const customerToClientMap = await syncClientsWithStripe();

        // Build email lookup for fallback matching
        const emailToClientMap = await buildEmailLookup();

        // Phase 2: Import payment intents
        await importPaymentIntents(customerToClientMap, emailToClientMap);

        // Phase 3: Import standalone charges
        await importStandaloneCharges(customerToClientMap, emailToClientMap);

        // Phase 4: Sync subscriptions
        await syncSubscriptions(customerToClientMap);

        // Phase 5: Flag payments needing commission calculation
        const needsCommission = await flagPaymentsForCommission();

        // Print summary
        printSummary();

        if (needsCommission > 0) {
            console.log(`\n⚠️  ${needsCommission} payments need commission calculation.`);
            console.log('   Run commission calculation from the admin UI or trigger webhook replays.');
        }

        if (stats.paymentsOrphaned > 0) {
            console.log(`\n⚠️  ${stats.paymentsOrphaned} payments couldn't be matched to clients.`);
            console.log('   Review these in the admin UI under orphaned payments.');
        }

        console.log('\n✓ Backfill completed successfully!');
        console.log('  Finished:', new Date().toISOString());

    } catch (error) {
        console.error('\n✗ Fatal error during backfill:', error);
        process.exit(1);
    }
}

main();
