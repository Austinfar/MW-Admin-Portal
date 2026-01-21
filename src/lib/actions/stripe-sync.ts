'use server';

import { stripe } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import { updateSyncStatus, SyncStatus } from './app-settings';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Stripe sync status file (separate from GHL sync)
const STRIPE_SYNC_STATUS_FILE = join(process.cwd(), '.stripe-sync-status.json');

export async function getStripeSyncStatus(): Promise<SyncStatus> {
    try {
        if (existsSync(STRIPE_SYNC_STATUS_FILE)) {
            const content = readFileSync(STRIPE_SYNC_STATUS_FILE, 'utf-8');
            return JSON.parse(content);
        }
    } catch (e) {
        // File doesn't exist or is invalid
    }

    return {
        state: 'idle',
        total: 0,
        processed: 0,
        synced: 0,
        matched_stripe: 0,
        unmatched_stripe: 0,
        errors: 0,
        last_updated: new Date().toISOString()
    };
}

export async function updateStripeSyncStatus(status: SyncStatus) {
    try {
        writeFileSync(STRIPE_SYNC_STATUS_FILE, JSON.stringify(status), 'utf-8');
    } catch (e) {
        console.error('[Stripe Sync Status] Failed to write status file:', e);
    }
}

/**
 * Searches for a Stripe customer by email.
 * Returns the customer ID if found, otherwise null.
 */
export async function findStripeCustomer(email: string): Promise<string | null> {
    if (!email) return null;

    try {
        console.log(`[Stripe API] querying customers.list for email: ${email}`);
        const customers = await stripe.customers.list({
            email: email,
            limit: 1,
        });

        if (customers.data.length > 0) {
            console.log(`[Stripe API] Found customer: ${customers.data[0].id}`);
            return customers.data[0].id;
        }

        console.log(`[Stripe API] No customer found for email: ${email}`);
        return null;
    } catch (error) {
        console.error('Error finding Stripe customer:', error);
        return null;
    }
}

/**
 * Sync all clients with their Stripe customer IDs
 * Looks up each client's email in Stripe and links them
 */
export async function syncAllClientsWithStripe() {
    const supabase = createAdminClient();

    // Reset status
    await updateStripeSyncStatus({
        state: 'syncing',
        total: 0,
        processed: 0,
        synced: 0,
        matched_stripe: 0,
        unmatched_stripe: 0,
        errors: 0,
        last_updated: new Date().toISOString()
    });

    // Get all clients
    const { data: clients, error } = await supabase
        .from('clients')
        .select('id, email, stripe_customer_id, name')
        .order('created_at', { ascending: false });

    if (error || !clients) {
        console.error('[Stripe Sync] Failed to fetch clients:', error);
        await updateStripeSyncStatus({
            state: 'error',
            total: 0,
            processed: 0,
            synced: 0,
            matched_stripe: 0,
            unmatched_stripe: 0,
            errors: 1,
            last_updated: new Date().toISOString()
        });
        return { error: 'Failed to fetch clients', synced: 0 };
    }

    const total = clients.length;
    let syncedCount = 0;
    let errorCount = 0;
    let linkedCount = 0;

    // Update with total
    await updateStripeSyncStatus({
        state: 'syncing',
        total,
        processed: 0,
        synced: 0,
        matched_stripe: 0,
        unmatched_stripe: 0,
        errors: 0,
        last_updated: new Date().toISOString()
    });

    // Small delay helper
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    for (const [index, client] of clients.entries()) {
        try {
            if (!client.email) {
                errorCount++;
                continue;
            }

            // Look up in Stripe
            const stripeCustomerId = await findStripeCustomer(client.email);

            if (stripeCustomerId) {
                // Update client if not already linked or different
                if (client.stripe_customer_id !== stripeCustomerId) {
                    const { error: updateError } = await supabase
                        .from('clients')
                        .update({ stripe_customer_id: stripeCustomerId })
                        .eq('id', client.id);

                    if (updateError) {
                        console.error(`[Stripe Sync] Failed to update client ${client.id}:`, updateError);
                        errorCount++;
                    } else {
                        linkedCount++;
                        console.log(`[Stripe Sync] Linked ${client.email} → ${stripeCustomerId}`);
                    }
                } else {
                    // Already linked
                    linkedCount++;
                }
                syncedCount++;
            }
            // If no Stripe customer found, that's okay - just not synced
        } catch (err: any) {
            console.error(`[Stripe Sync] Error processing ${client.email}:`, err.message);
            errorCount++;
        }

        // Update progress
        await updateStripeSyncStatus({
            state: 'syncing',
            total,
            processed: index + 1,
            synced: syncedCount,
            matched_stripe: linkedCount,
            unmatched_stripe: syncedCount - linkedCount,
            errors: errorCount,
            last_updated: new Date().toISOString()
        });

        // Rate limit - Stripe allows 100 requests/sec in live mode
        await delay(50);
    }

    // Final status
    await updateStripeSyncStatus({
        state: 'completed',
        total,
        processed: total,
        synced: syncedCount,
        matched_stripe: linkedCount,
        unmatched_stripe: syncedCount - linkedCount,
        errors: errorCount,
        last_updated: new Date().toISOString()
    });

    return {
        success: true,
        synced: syncedCount,
        linked: linkedCount,
        errors: errorCount,
        total
    };
}

/**
 * Sync payments from Stripe for all linked clients
 * Fetches recent payments and links them to clients
 */
export async function syncStripePayments(daysBack: number = 30) {
    const supabase = createAdminClient();

    // Calculate date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    try {
        // Get all payments from Stripe
        const payments = await stripe.paymentIntents.list({
            created: {
                gte: Math.floor(startDate.getTime() / 1000)
            },
            limit: 100,
        });

        let syncedCount = 0;
        let linkedCount = 0;

        for (const payment of payments.data) {
            // Remove check: if (payment.status !== 'succeeded') continue;
            // We want ALL payments now (succeeded, failed, requires_method, etc.)

            const stripeCustomerId = typeof payment.customer === 'string'
                ? payment.customer
                : payment.customer?.id || null;

            let clientId: string | null = null;

            // Try to match by customer ID first
            if (stripeCustomerId) {
                const { data: client } = await supabase
                    .from('clients')
                    .select('id')
                    .eq('stripe_customer_id', stripeCustomerId)
                    .single();

                if (client) {
                    clientId = client.id;
                }
            }

            // Fall back to email match
            if (!clientId && payment.receipt_email) {
                const { data: client } = await supabase
                    .from('clients')
                    .select('id')
                    .eq('email', payment.receipt_email)
                    .single();

                if (client) {
                    clientId = client.id;
                }
            }

            // Upsert payment
            // Extract email from receipt_email OR billing_details
            let email = payment.receipt_email;

            // Cast to any to access expanded or nested properties that might not be in the base PaymentIntent type definition
            const paymentAny = payment as any;
            if (!email && paymentAny.charges?.data?.[0]?.billing_details?.email) {
                email = paymentAny.charges.data[0].billing_details.email;
            }

            const { error } = await supabase.from('payments').upsert({
                stripe_payment_id: payment.id,
                amount: payment.amount / 100, // Store in Dollars (35000 -> 350)
                currency: payment.currency,
                status: payment.status,
                payment_date: new Date(payment.created * 1000).toISOString(),
                client_email: email ?? null,
                stripe_customer_id: stripeCustomerId,
                client_id: clientId,
                product_name: payment.description,
            }, {
                onConflict: 'stripe_payment_id'
            });

            if (!error) {
                syncedCount++;
                if (clientId) linkedCount++;
            }
        }

        return {
            success: true,
            synced: syncedCount,
            linked: linkedCount,
            total: payments.data.length
        };
    } catch (error: any) {
        console.error('[Stripe Payment Sync] Error:', error);
        return { error: error.message, synced: 0 };
    }
}

/**
 * Sync payments from Stripe for a SINGLE client by their stripe_customer_id
 */
export async function syncClientPaymentsFromStripe(clientId: string, stripeCustomerId: string) {
    if (!stripeCustomerId) {
        return { error: 'No Stripe customer ID provided', synced: 0 };
    }

    const supabase = createAdminClient();

    try {
        // Get all payment intents for this customer
        const payments = await stripe.paymentIntents.list({
            customer: stripeCustomerId,
            limit: 100,
        });

        let syncedCount = 0;

        for (const payment of payments.data) {
            let email = payment.receipt_email;
            const paymentAny = payment as any;
            if (!email && paymentAny.charges?.data?.[0]?.billing_details?.email) {
                email = paymentAny.charges.data[0].billing_details.email;
            }

            const { error } = await supabase.from('payments').upsert({
                stripe_payment_id: payment.id,
                amount: payment.amount / 100,
                currency: payment.currency,
                status: payment.status,
                payment_date: new Date(payment.created * 1000).toISOString(),
                client_email: email ?? null,
                stripe_customer_id: stripeCustomerId,
                client_id: clientId,
                product_name: payment.description,
            }, {
                onConflict: 'stripe_payment_id'
            });

            if (!error) syncedCount++;
        }

        // Also sync standalone charges
        const charges = await stripe.charges.list({
            customer: stripeCustomerId,
            limit: 100,
        });

        for (const charge of charges.data) {
            if (charge.payment_intent) continue;

            const { error } = await supabase.from('payments').upsert({
                stripe_payment_id: charge.id,
                amount: charge.amount / 100,
                currency: charge.currency,
                status: charge.status === 'succeeded' ? 'succeeded' : charge.status,
                payment_date: new Date(charge.created * 1000).toISOString(),
                client_email: charge.billing_details?.email ?? charge.receipt_email ?? null,
                stripe_customer_id: stripeCustomerId,
                client_id: clientId,
                product_name: charge.description,
            }, {
                onConflict: 'stripe_payment_id'
            });

            if (!error) syncedCount++;
        }

        return { success: true, synced: syncedCount };
    } catch (error: any) {
        console.error('[Client Payment Sync] Error:', error);
        return { error: error.message, synced: 0 };
    }
}

/**
 * Sync active subscriptions from Stripe
 */
export async function syncStripeSubscriptions() {
    const supabase = createAdminClient();

    try {
        const subscriptions = await stripe.subscriptions.list({
            limit: 100,
            status: 'all', // Fetch all to handle cancellations updates
            expand: ['data.customer']
        });

        let syncedCount = 0;

        for (const sub of subscriptions.data) {
            const stripeCustomerId = typeof sub.customer === 'string'
                ? sub.customer
                : sub.customer.id;

            // Cast to any for properties that might be missing in strict types or expansion
            const subAny = sub as any;
            const currentPeriodEnd = subAny.current_period_end
                ? new Date(subAny.current_period_end * 1000).toISOString()
                : null;

            const unitAmount = sub.items.data[0]?.price?.unit_amount || 0;

            const { error } = await supabase.from('subscriptions').upsert({
                stripe_subscription_id: sub.id,
                stripe_customer_id: stripeCustomerId,
                status: sub.status,
                amount: unitAmount / 100, // Store in Dollars
                currency: sub.currency,
                interval: sub.items.data[0]?.price?.recurring?.interval || 'month',
                current_period_end: currentPeriodEnd,
                cancel_at_period_end: sub.cancel_at_period_end,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'stripe_subscription_id'
            });

            if (!error) {
                syncedCount++;
            } else {
                console.error(`[Subscription Sync] Error upserting ${sub.id}:`, error);
            }
        }

        return { success: true, count: syncedCount, hasMore: subscriptions.has_more };
    } catch (error: any) {
        console.error('[Subscription Sync] Error:', error);
        return { error: error.message };
    }
}
