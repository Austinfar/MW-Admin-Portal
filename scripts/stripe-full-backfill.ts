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

interface BackfillStats {
    clientsTotal: number;
    clientsLinked: number;
    paymentsTotal: number;
    paymentsSynced: number;
    paymentsLinkedToClient: number;
    paymentsOrphaned: number;
    errors: number;
}

const stats: BackfillStats = {
    clientsTotal: 0,
    clientsLinked: 0,
    paymentsTotal: 0,
    paymentsSynced: 0,
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
 * Database allows: succeeded, failed, refunded, partially_refunded, disputed, pending
 */
function mapStripeStatus(stripeStatus: string): string {
    const statusMap: Record<string, string> = {
        'succeeded': 'succeeded',
        'canceled': 'failed',
        'requires_payment_method': 'pending',
        'requires_confirmation': 'pending',
        'requires_action': 'pending',
        'processing': 'pending',
        'requires_capture': 'pending'
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

    // Get all clients
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
            // Look up customer in Stripe by email
            const customers = await stripe.customers.list({
                email: client.email,
                limit: 1
            });

            if (customers.data.length > 0) {
                const stripeCustomerId = customers.data[0].id;

                // Update client with Stripe customer ID
                const { error: updateError } = await supabase
                    .from('clients')
                    .update({ stripe_customer_id: stripeCustomerId })
                    .eq('id', client.id);

                if (!updateError) {
                    customerToClientMap.set(stripeCustomerId, client.id);
                    stats.clientsLinked++;
                    console.log(`  Linked: ${client.name} (${client.email}) -> ${stripeCustomerId}`);
                }
            }
        } catch (err: any) {
            console.error(`  Error linking ${client.email}:`, err.message);
            stats.errors++;
        }

        // Rate limiting
        await delay(50);

        // Progress update every 20 clients
        if (processed % 20 === 0) {
            console.log(`  Progress: ${processed}/${clients.length} clients processed`);
        }
    }

    console.log(`\nPhase 1 complete: ${stats.clientsLinked}/${stats.clientsTotal} clients linked to Stripe`);

    // Also build map from existing client data
    for (const client of clients) {
        if (client.stripe_customer_id && !customerToClientMap.has(client.stripe_customer_id)) {
            customerToClientMap.set(client.stripe_customer_id, client.id);
        }
    }

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

    return emailToClientMap;
}

/**
 * Phase 2: Import all payments from Stripe with pagination
 */
async function importAllPayments(
    customerToClientMap: Map<string, string>,
    emailToClientMap: Map<string, string>
): Promise<void> {
    console.log('\n' + '='.repeat(60));
    console.log('PHASE 2: Importing all payments from Stripe');
    console.log('='.repeat(60));

    let hasMore = true;
    let startingAfter: string | undefined;
    let pageCount = 0;

    while (hasMore) {
        pageCount++;
        console.log(`\nFetching page ${pageCount}...`);

        try {
            const params: Stripe.PaymentIntentListParams = {
                limit: 100,
                expand: ['data.latest_charge']
            };

            if (startingAfter) {
                params.starting_after = startingAfter;
            }

            const paymentIntents = await stripe.paymentIntents.list(params);

            console.log(`  Retrieved ${paymentIntents.data.length} payment intents`);

            for (const payment of paymentIntents.data) {
                stats.paymentsTotal++;

                // Only process succeeded payments for the main sync
                // Other statuses can be tracked but won't have commissions
                const stripeCustomerId = typeof payment.customer === 'string'
                    ? payment.customer
                    : (payment.customer as Stripe.Customer)?.id || null;

                // Try to match to client
                let clientId: string | null = null;

                // First: match by Stripe customer ID
                if (stripeCustomerId && customerToClientMap.has(stripeCustomerId)) {
                    clientId = customerToClientMap.get(stripeCustomerId) || null;
                }

                // Fallback: match by email
                if (!clientId) {
                    let email = payment.receipt_email;

                    // Try to get email from charge billing details
                    if (!email && payment.latest_charge) {
                        const charge = payment.latest_charge as Stripe.Charge;
                        email = charge.billing_details?.email || null;
                    }

                    if (email && emailToClientMap.has(email.toLowerCase())) {
                        clientId = emailToClientMap.get(email.toLowerCase()) || null;
                    }
                }

                // Calculate Stripe fee
                const stripeFee = calculateStripeFee(payment.amount);
                const netAmount = (payment.amount / 100) - stripeFee;

                // Get email for storage
                let clientEmail = payment.receipt_email;
                if (!clientEmail && payment.latest_charge) {
                    const charge = payment.latest_charge as Stripe.Charge;
                    clientEmail = charge.billing_details?.email || null;
                }

                // Upsert payment
                const { error } = await supabase.from('payments').upsert({
                    stripe_payment_id: payment.id,
                    amount: payment.amount / 100,
                    currency: payment.currency,
                    status: mapStripeStatus(payment.status),
                    payment_date: new Date(payment.created * 1000).toISOString(),
                    client_email: clientEmail,
                    stripe_customer_id: stripeCustomerId,
                    client_id: clientId,
                    product_name: payment.description,
                    stripe_fee: stripeFee,
                    net_amount: netAmount,
                    // Don't overwrite commission_calculated if already true
                    // commission_calculated: false, // Let existing value persist
                    review_status: clientId ? null : 'pending_review'
                }, {
                    onConflict: 'stripe_payment_id'
                });

                if (error) {
                    console.error(`  Error upserting payment ${payment.id}:`, error.message);
                    stats.errors++;
                } else {
                    stats.paymentsSynced++;
                    if (clientId) {
                        stats.paymentsLinkedToClient++;
                    } else {
                        stats.paymentsOrphaned++;
                    }
                }
            }

            // Check for more pages
            hasMore = paymentIntents.has_more;
            if (hasMore && paymentIntents.data.length > 0) {
                startingAfter = paymentIntents.data[paymentIntents.data.length - 1].id;
            }

            // Rate limiting between pages
            await delay(100);

        } catch (err: any) {
            console.error(`  Error fetching page ${pageCount}:`, err.message);
            stats.errors++;
            // Continue to next page on error
            hasMore = false;
        }
    }

    console.log(`\nPhase 2 complete:`);
    console.log(`  Total payments processed: ${stats.paymentsTotal}`);
    console.log(`  Successfully synced: ${stats.paymentsSynced}`);
    console.log(`  Linked to clients: ${stats.paymentsLinkedToClient}`);
    console.log(`  Orphaned (pending review): ${stats.paymentsOrphaned}`);
}

/**
 * Phase 3: Calculate commissions for unprocessed payments
 */
async function calculateMissingCommissions(): Promise<number> {
    console.log('\n' + '='.repeat(60));
    console.log('PHASE 3: Calculating commissions for unprocessed payments');
    console.log('='.repeat(60));

    // Find succeeded payments with clients that haven't had commissions calculated
    const { data: uncalculated, error } = await supabase
        .from('payments')
        .select('id')
        .eq('status', 'succeeded')
        .not('client_id', 'is', null)
        .or('commission_calculated.is.null,commission_calculated.eq.false');

    if (error) {
        console.error('Error fetching uncalculated payments:', error);
        return 0;
    }

    if (!uncalculated || uncalculated.length === 0) {
        console.log('No payments need commission calculation.');
        return 0;
    }

    console.log(`Found ${uncalculated.length} payments needing commission calculation\n`);

    // Import the commission calculator dynamically
    // Since we're in a script, we need to call the API or duplicate the logic
    // For now, we'll just mark them and let you know to trigger via the app

    console.log('To calculate commissions, run the following for each payment ID:');
    console.log('  - Use the admin UI commission recalculation feature, OR');
    console.log('  - Trigger webhook replay from Stripe dashboard');
    console.log('\nPayment IDs needing calculation:');

    for (const payment of uncalculated.slice(0, 20)) {
        console.log(`  - ${payment.id}`);
    }

    if (uncalculated.length > 20) {
        console.log(`  ... and ${uncalculated.length - 20} more`);
    }

    return uncalculated.length;
}

/**
 * Print final summary
 */
function printSummary(): void {
    console.log('\n' + '='.repeat(60));
    console.log('BACKFILL COMPLETE - SUMMARY');
    console.log('='.repeat(60));
    console.log(`
  Clients:
    Total:              ${stats.clientsTotal}
    Linked to Stripe:   ${stats.clientsLinked}

  Payments:
    Total from Stripe:  ${stats.paymentsTotal}
    Successfully synced: ${stats.paymentsSynced}
    Linked to clients:  ${stats.paymentsLinkedToClient}
    Orphaned:           ${stats.paymentsOrphaned}

  Errors:               ${stats.errors}
`);
}

async function main() {
    console.log('='.repeat(60));
    console.log('  STRIPE FULL BACKFILL');
    console.log('  Started:', new Date().toISOString());
    console.log('='.repeat(60));

    try {
        // Phase 1: Link clients to Stripe
        const customerToClientMap = await syncClientsWithStripe();

        // Build email lookup for fallback matching
        const emailToClientMap = await buildEmailLookup();

        // Phase 2: Import all payments
        await importAllPayments(customerToClientMap, emailToClientMap);

        // Phase 3: Flag payments needing commission calculation
        const needsCommission = await calculateMissingCommissions();

        // Print summary
        printSummary();

        if (needsCommission > 0) {
            console.log(`\nNOTE: ${needsCommission} payments need commission calculation.`);
            console.log('Run commission calculation from the admin UI or trigger webhook replays.');
        }

        if (stats.paymentsOrphaned > 0) {
            console.log(`\nNOTE: ${stats.paymentsOrphaned} payments couldn't be matched to clients.`);
            console.log('Review these in the admin UI under orphaned payments.');
        }

    } catch (error) {
        console.error('Fatal error during backfill:', error);
        process.exit(1);
    }
}

main();
