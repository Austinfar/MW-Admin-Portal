'use server';

import { stripe } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import { updateSyncStatus, SyncStatus } from './app-settings';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import Stripe from 'stripe';

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
        // Get all payments from Stripe with expanded charge and balance_transaction for actual fees
        const payments = await stripe.paymentIntents.list({
            created: {
                gte: Math.floor(startDate.getTime() / 1000)
            },
            limit: 100,
            expand: ['data.latest_charge.balance_transaction']
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

            // Extract email and fee from the charge
            let email = payment.receipt_email;
            let stripeFee: number | null = null;

            const charge = payment.latest_charge as any;
            if (charge) {
                // Get email from charge if not on payment intent
                if (!email) {
                    email = charge.billing_details?.email || charge.receipt_email || null;
                }

                // Get actual fee from balance transaction
                const balanceTransaction = charge.balance_transaction;
                if (balanceTransaction && typeof balanceTransaction !== 'string') {
                    stripeFee = balanceTransaction.fee / 100;
                }
            }

            // Fall back to email match
            if (!clientId && email) {
                const { data: client } = await supabase
                    .from('clients')
                    .select('id')
                    .eq('email', email)
                    .single();

                if (client) {
                    clientId = client.id;
                }
            }

            // Calculate net amount
            const amount = payment.amount / 100;
            const netAmount = stripeFee !== null ? amount - stripeFee : null;

            const { error } = await supabase.from('payments').upsert({
                stripe_payment_id: payment.id,
                amount, // Store in Dollars (35000 -> 350)
                stripe_fee: stripeFee,
                net_amount: netAmount,
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
 * Includes refund data for accurate lifetime value calculations
 */
export async function syncClientPaymentsFromStripe(clientId: string, stripeCustomerId: string) {
    if (!stripeCustomerId) {
        return { error: 'No Stripe customer ID provided', synced: 0 };
    }

    const supabase = createAdminClient();

    try {
        // Get all payment intents for this customer with expanded charge and balance_transaction
        const payments = await stripe.paymentIntents.list({
            customer: stripeCustomerId,
            limit: 100,
            expand: ['data.latest_charge.balance_transaction']
        });

        let syncedCount = 0;
        let refundsFound = 0;

        for (const payment of payments.data) {
            let email = payment.receipt_email;
            let stripeFee: number | null = null;
            let refundAmount: number | null = null;
            let status = payment.status;

            const charge = payment.latest_charge as any;
            if (charge) {
                // Get email from charge if not on payment intent
                if (!email) {
                    email = charge.billing_details?.email || charge.receipt_email || null;
                }

                // Get actual fee from balance transaction
                const balanceTransaction = charge.balance_transaction;
                if (balanceTransaction && typeof balanceTransaction !== 'string') {
                    stripeFee = balanceTransaction.fee / 100;
                }

                // Check for refunds on the charge
                if (charge.refunded) {
                    status = 'refunded' as any;
                    refundAmount = (charge.amount_refunded || 0) / 100;
                    refundsFound++;
                } else if (charge.amount_refunded && charge.amount_refunded > 0) {
                    status = 'partially_refunded' as any;
                    refundAmount = charge.amount_refunded / 100;
                    refundsFound++;
                }
            }

            const amount = payment.amount / 100;
            const netAmount = stripeFee !== null ? amount - stripeFee : null;

            const { error } = await supabase.from('payments').upsert({
                stripe_payment_id: payment.id,
                amount,
                stripe_fee: stripeFee,
                net_amount: netAmount,
                currency: payment.currency,
                status,
                payment_date: new Date(payment.created * 1000).toISOString(),
                client_email: email ?? null,
                stripe_customer_id: stripeCustomerId,
                client_id: clientId,
                product_name: payment.description,
                refund_amount: refundAmount,
                refunded_at: refundAmount ? new Date().toISOString() : null,
            }, {
                onConflict: 'stripe_payment_id'
            });

            if (!error) syncedCount++;
        }

        // Also sync standalone charges with expanded balance_transaction
        const charges = await stripe.charges.list({
            customer: stripeCustomerId,
            limit: 100,
            expand: ['data.balance_transaction']
        });

        for (const charge of charges.data) {
            if (charge.payment_intent) continue;

            // Get actual fee from balance transaction
            let stripeFee: number | null = null;
            const balanceTransaction = charge.balance_transaction as any;
            if (balanceTransaction && typeof balanceTransaction !== 'string') {
                stripeFee = balanceTransaction.fee / 100;
            }

            const amount = charge.amount / 100;
            const netAmount = stripeFee !== null ? amount - stripeFee : null;

            // Check for refunds
            let status: string = charge.status === 'succeeded' ? 'succeeded' : charge.status;
            let refundAmount: number | null = null;

            if (charge.refunded) {
                status = 'refunded';
                refundAmount = (charge.amount_refunded || 0) / 100;
                refundsFound++;
            } else if (charge.amount_refunded && charge.amount_refunded > 0) {
                status = 'partially_refunded';
                refundAmount = charge.amount_refunded / 100;
                refundsFound++;
            }

            const { error } = await supabase.from('payments').upsert({
                stripe_payment_id: charge.id,
                amount,
                stripe_fee: stripeFee,
                net_amount: netAmount,
                currency: charge.currency,
                status,
                payment_date: new Date(charge.created * 1000).toISOString(),
                client_email: charge.billing_details?.email ?? charge.receipt_email ?? null,
                stripe_customer_id: stripeCustomerId,
                client_id: clientId,
                product_name: charge.description,
                refund_amount: refundAmount,
                refunded_at: refundAmount ? new Date().toISOString() : null,
            }, {
                onConflict: 'stripe_payment_id'
            });

            if (!error) syncedCount++;
        }

        return { success: true, synced: syncedCount, refundsFound };
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

/**
 * Backfill actual Stripe fees for existing payments
 * Updates payments that have estimated or missing fees with real data from Stripe
 */
export async function backfillStripeFees() {
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

    // Fetch all payments that might need fee updates
    const { data: payments, error } = await supabase
        .from('payments')
        .select('id, stripe_payment_id, amount, stripe_fee, net_amount')
        .not('stripe_payment_id', 'is', null)
        .order('created_at', { ascending: false });

    if (error || !payments) {
        console.error('[Fee Backfill] Failed to fetch payments:', error);
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
        return { error: 'Failed to fetch payments', updated: 0 };
    }

    const total = payments.length;
    let updatedCount = 0;
    let skippedCount = 0;
    let notFoundCount = 0;
    let errorCount = 0;

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

    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    for (const [index, payment] of payments.entries()) {
        if (!payment.stripe_payment_id) {
            skippedCount++;
            continue;
        }

        // Check if fee looks like an estimate (2.9% + $0.30)
        const estimatedFee = Number((payment.amount * 0.029 + 0.30).toFixed(2));
        const currentFee = Number(payment.stripe_fee) || 0;
        const isEstimatedFee = currentFee === 0 || Math.abs(currentFee - estimatedFee) < 0.01;

        if (!isEstimatedFee && payment.stripe_fee !== null) {
            skippedCount++;
            // Update progress
            await updateStripeSyncStatus({
                state: 'syncing',
                total,
                processed: index + 1,
                synced: updatedCount,
                matched_stripe: updatedCount,
                unmatched_stripe: notFoundCount,
                errors: errorCount,
                last_updated: new Date().toISOString()
            });
            continue;
        }

        try {
            const feeData = await getActualStripeFeeFromStripe(payment.stripe_payment_id);

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
                        console.error(`[Fee Backfill] Error updating payment ${payment.id}:`, updateError.message);
                        errorCount++;
                    } else {
                        updatedCount++;
                    }
                } else {
                    skippedCount++;
                }
            } else {
                notFoundCount++;
            }
        } catch (err: any) {
            console.error(`[Fee Backfill] Error fetching fee for ${payment.stripe_payment_id}:`, err.message);
            errorCount++;
        }

        // Update progress
        await updateStripeSyncStatus({
            state: 'syncing',
            total,
            processed: index + 1,
            synced: updatedCount,
            matched_stripe: updatedCount,
            unmatched_stripe: notFoundCount,
            errors: errorCount,
            last_updated: new Date().toISOString()
        });

        // Rate limit
        await delay(25);
    }

    // Final status
    await updateStripeSyncStatus({
        state: 'completed',
        total,
        processed: total,
        synced: updatedCount,
        matched_stripe: updatedCount,
        unmatched_stripe: notFoundCount,
        errors: errorCount,
        last_updated: new Date().toISOString()
    });

    return {
        success: true,
        updated: updatedCount,
        skipped: skippedCount,
        notFound: notFoundCount,
        errors: errorCount,
        total
    };
}

/**
 * Helper to fetch actual Stripe fee for a payment
 */
async function getActualStripeFeeFromStripe(stripePaymentId: string): Promise<{ fee: number; netAmount: number } | null> {
    try {
        if (stripePaymentId.startsWith('pi_')) {
            const paymentIntent = await stripe.paymentIntents.retrieve(stripePaymentId, {
                expand: ['latest_charge.balance_transaction']
            });

            const charge = paymentIntent.latest_charge as Stripe.Charge | null;
            if (charge) {
                const balanceTransaction = charge.balance_transaction as Stripe.BalanceTransaction | null;
                if (balanceTransaction && typeof balanceTransaction !== 'string') {
                    return {
                        fee: balanceTransaction.fee / 100,
                        netAmount: balanceTransaction.net / 100
                    };
                }
            }
        } else if (stripePaymentId.startsWith('ch_')) {
            const charge = await stripe.charges.retrieve(stripePaymentId, {
                expand: ['balance_transaction']
            });

            const balanceTransaction = charge.balance_transaction as Stripe.BalanceTransaction | null;
            if (balanceTransaction && typeof balanceTransaction !== 'string') {
                return {
                    fee: balanceTransaction.fee / 100,
                    netAmount: balanceTransaction.net / 100
                };
            }
        } else if (stripePaymentId.startsWith('in_')) {
            // For invoices, get the payment intent and then the charge
            const invoice = await stripe.invoices.retrieve(stripePaymentId) as any;
            const paymentIntentId = typeof invoice.payment_intent === 'string'
                ? invoice.payment_intent
                : invoice.payment_intent?.id;

            if (paymentIntentId) {
                const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
                    expand: ['latest_charge.balance_transaction']
                });
                const charge = paymentIntent.latest_charge as Stripe.Charge | null;
                if (charge) {
                    const balanceTransaction = charge.balance_transaction as Stripe.BalanceTransaction | null;
                    if (balanceTransaction && typeof balanceTransaction !== 'string') {
                        return {
                            fee: balanceTransaction.fee / 100,
                            netAmount: balanceTransaction.net / 100
                        };
                    }
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
 * Full 12-month backfill from Stripe
 * Imports all payment intents and standalone charges from the last 12 months
 */
export async function fullStripeBackfill() {
    const supabase = createAdminClient();
    const TWELVE_MONTHS_AGO = Math.floor(Date.now() / 1000) - (365 * 24 * 60 * 60);

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

    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // Build customer-to-client and email-to-client maps
    const { data: clients } = await supabase
        .from('clients')
        .select('id, email, stripe_customer_id');

    const customerToClientMap = new Map<string, string>();
    const emailToClientMap = new Map<string, string>();

    clients?.forEach(client => {
        if (client.stripe_customer_id) {
            customerToClientMap.set(client.stripe_customer_id, client.id);
        }
        if (client.email) {
            emailToClientMap.set(client.email.toLowerCase(), client.id);
        }
    });

    let totalProcessed = 0;
    let syncedCount = 0;
    let linkedCount = 0;
    let orphanedCount = 0;
    let errorCount = 0;

    // Phase 1: Payment Intents
    let hasMore = true;
    let startingAfter: string | undefined;

    while (hasMore) {
        try {
            const params: Stripe.PaymentIntentListParams = {
                limit: 100,
                created: { gte: TWELVE_MONTHS_AGO },
                expand: ['data.latest_charge.balance_transaction']
            };

            if (startingAfter) {
                params.starting_after = startingAfter;
            }

            const paymentIntents = await stripe.paymentIntents.list(params);

            for (const payment of paymentIntents.data) {
                totalProcessed++;

                const stripeCustomerId = typeof payment.customer === 'string'
                    ? payment.customer
                    : (payment.customer as Stripe.Customer)?.id || null;

                let clientId: string | null = null;

                if (stripeCustomerId && customerToClientMap.has(stripeCustomerId)) {
                    clientId = customerToClientMap.get(stripeCustomerId) || null;
                }

                // Get fee and email from charge
                const charge = payment.latest_charge as Stripe.Charge | null;
                const balanceTransaction = charge?.balance_transaction as Stripe.BalanceTransaction | null;

                let stripeFee: number | null = null;
                if (balanceTransaction && typeof balanceTransaction !== 'string') {
                    stripeFee = balanceTransaction.fee / 100;
                }

                let clientEmail = payment.receipt_email;
                if (!clientEmail && charge) {
                    clientEmail = charge.billing_details?.email || null;
                }

                // Fallback: match by email
                if (!clientId && clientEmail && emailToClientMap.has(clientEmail.toLowerCase())) {
                    clientId = emailToClientMap.get(clientEmail.toLowerCase()) || null;
                }

                const amount = payment.amount / 100;
                const netAmount = stripeFee !== null ? amount - stripeFee : null;

                // Check for refunds
                let refundAmount = 0;
                let status = payment.status;

                if (charge) {
                    if (charge.refunded) {
                        status = 'refunded' as any;
                        refundAmount = (charge.amount_refunded || 0) / 100;
                    } else if (charge.amount_refunded && charge.amount_refunded > 0) {
                        status = 'partially_refunded' as any;
                        refundAmount = charge.amount_refunded / 100;
                    }
                }

                const { error } = await supabase.from('payments').upsert({
                    stripe_payment_id: payment.id,
                    amount,
                    currency: payment.currency,
                    status,
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
                    errorCount++;
                } else {
                    syncedCount++;
                    if (clientId) {
                        linkedCount++;
                    } else {
                        orphanedCount++;
                    }
                }

                // Update progress periodically
                if (totalProcessed % 10 === 0) {
                    await updateStripeSyncStatus({
                        state: 'syncing',
                        total: totalProcessed, // We don't know total upfront
                        processed: totalProcessed,
                        synced: syncedCount,
                        matched_stripe: linkedCount,
                        unmatched_stripe: orphanedCount,
                        errors: errorCount,
                        last_updated: new Date().toISOString()
                    });
                }
            }

            hasMore = paymentIntents.has_more;
            if (hasMore && paymentIntents.data.length > 0) {
                startingAfter = paymentIntents.data[paymentIntents.data.length - 1].id;
            }

            await delay(100);
        } catch (err: any) {
            console.error('[Full Backfill] Error fetching payment intents:', err.message);
            errorCount++;
            hasMore = false;
        }
    }

    // Phase 2: Standalone Charges
    hasMore = true;
    startingAfter = undefined;

    while (hasMore) {
        try {
            const params: Stripe.ChargeListParams = {
                limit: 100,
                created: { gte: TWELVE_MONTHS_AGO },
                expand: ['data.balance_transaction']
            };

            if (startingAfter) {
                params.starting_after = startingAfter;
            }

            const charges = await stripe.charges.list(params);

            for (const charge of charges.data) {
                // Skip charges with payment intents (already imported)
                if (charge.payment_intent) continue;

                totalProcessed++;

                const stripeCustomerId = typeof charge.customer === 'string'
                    ? charge.customer
                    : (charge.customer as Stripe.Customer)?.id || null;

                let clientId: string | null = null;

                if (stripeCustomerId && customerToClientMap.has(stripeCustomerId)) {
                    clientId = customerToClientMap.get(stripeCustomerId) || null;
                }

                const balanceTransaction = charge.balance_transaction as Stripe.BalanceTransaction | null;
                let stripeFee: number | null = null;
                if (balanceTransaction && typeof balanceTransaction !== 'string') {
                    stripeFee = balanceTransaction.fee / 100;
                }

                const clientEmail = charge.billing_details?.email || charge.receipt_email || null;

                if (!clientId && clientEmail && emailToClientMap.has(clientEmail.toLowerCase())) {
                    clientId = emailToClientMap.get(clientEmail.toLowerCase()) || null;
                }

                const amount = charge.amount / 100;
                const netAmount = stripeFee !== null ? amount - stripeFee : null;

                let status: string = charge.status === 'succeeded' ? 'succeeded' : charge.status;
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
                    amount,
                    currency: charge.currency,
                    status,
                    payment_date: new Date(charge.created * 1000).toISOString(),
                    client_email: clientEmail,
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
                    errorCount++;
                } else {
                    syncedCount++;
                    if (clientId) {
                        linkedCount++;
                    } else {
                        orphanedCount++;
                    }
                }

                if (totalProcessed % 10 === 0) {
                    await updateStripeSyncStatus({
                        state: 'syncing',
                        total: totalProcessed,
                        processed: totalProcessed,
                        synced: syncedCount,
                        matched_stripe: linkedCount,
                        unmatched_stripe: orphanedCount,
                        errors: errorCount,
                        last_updated: new Date().toISOString()
                    });
                }
            }

            hasMore = charges.has_more;
            if (hasMore && charges.data.length > 0) {
                startingAfter = charges.data[charges.data.length - 1].id;
            }

            await delay(100);
        } catch (err: any) {
            console.error('[Full Backfill] Error fetching charges:', err.message);
            errorCount++;
            hasMore = false;
        }
    }

    // Final status
    await updateStripeSyncStatus({
        state: 'completed',
        total: totalProcessed,
        processed: totalProcessed,
        synced: syncedCount,
        matched_stripe: linkedCount,
        unmatched_stripe: orphanedCount,
        errors: errorCount,
        last_updated: new Date().toISOString()
    });

    return {
        success: true,
        synced: syncedCount,
        linked: linkedCount,
        orphaned: orphanedCount,
        errors: errorCount,
        total: totalProcessed
    };
}
