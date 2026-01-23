/**
 * Subscription Webhook Handlers
 * Handles Stripe subscription lifecycle events
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { notifyOfPaymentFailure } from '@/lib/actions/subscription-notifications';
import Stripe from 'stripe';

/**
 * Handle subscription updates from Stripe
 * Syncs pause/resume/cancellation state to our database
 */
export async function handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    const supabase = createAdminClient();
    const stripeSubscriptionId = subscription.id;
    // Cast to any for accessing properties that may not be in current type definitions
    const subscriptionAny = subscription as any;

    console.log(`[Subscription Webhook] Processing update for ${stripeSubscriptionId}`);

    try {
        // Extract subscription data
        const status = subscription.status;
        const cancelAtPeriodEnd = subscription.cancel_at_period_end;
        const pauseCollection = subscription.pause_collection;
        const currentPeriodEnd = subscriptionAny.current_period_end;

        // Get price/product info if available
        const price = subscription.items.data[0]?.price;
        const product = price?.product as Stripe.Product | null;

        const updateData: Record<string, any> = {
            status,
            cancel_at_period_end: cancelAtPeriodEnd,
            current_period_end: currentPeriodEnd
                ? new Date(currentPeriodEnd * 1000).toISOString()
                : null,
            next_billing_date: currentPeriodEnd
                ? new Date(currentPeriodEnd * 1000).toISOString()
                : null,
            updated_at: new Date().toISOString(),
        };

        // Handle pause state
        if (pauseCollection) {
            updateData.pause_collection_behavior = pauseCollection.behavior || 'void';
            updateData.paused_at = updateData.paused_at || new Date().toISOString();
            updateData.resume_at = pauseCollection.resumes_at
                ? new Date(pauseCollection.resumes_at * 1000).toISOString()
                : null;
        } else {
            updateData.pause_collection_behavior = null;
            updateData.paused_at = null;
            updateData.resume_at = null;
        }

        // Handle cancellation
        if (subscriptionAny.canceled_at) {
            updateData.cancelled_at = new Date(subscriptionAny.canceled_at * 1000).toISOString();
        }

        // Update plan info if available
        if (price) {
            updateData.amount = (price.unit_amount || 0) / 100;
            updateData.currency = price.currency;
            updateData.interval = price.recurring?.interval || 'month';
            updateData.interval_count = price.recurring?.interval_count || 1;
        }
        if (product && typeof product !== 'string') {
            updateData.plan_name = product.name;
        }

        // Get customer ID
        const customerId = typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer.id;

        // Upsert subscription record
        const { error } = await supabase
            .from('subscriptions')
            .upsert({
                stripe_subscription_id: stripeSubscriptionId,
                stripe_customer_id: customerId,
                ...updateData,
            }, {
                onConflict: 'stripe_subscription_id',
            });

        if (error) {
            console.error('[Subscription Webhook] Failed to update subscription:', error);
            return;
        }

        // If subscription was unpaused (pauseCollection removed), update active freezes
        if (!pauseCollection) {
            const { data: activeFreeze } = await supabase
                .from('subscription_freezes')
                .select('id')
                .eq('stripe_subscription_id', stripeSubscriptionId)
                .eq('status', 'active')
                .single();

            if (activeFreeze) {
                await supabase
                    .from('subscription_freezes')
                    .update({
                        status: 'resumed',
                        actual_resumed_at: new Date().toISOString(),
                    })
                    .eq('id', activeFreeze.id);

                console.log(`[Subscription Webhook] Marked freeze ${activeFreeze.id} as resumed`);
            }
        }

        // Create activity log if we have a client linked
        const { data: sub } = await supabase
            .from('subscriptions')
            .select('client_id')
            .eq('stripe_subscription_id', stripeSubscriptionId)
            .single();

        if (sub?.client_id) {
            let logDescription = `Subscription updated: status=${status}`;
            if (cancelAtPeriodEnd) {
                logDescription = 'Subscription will cancel at end of period';
            } else if (pauseCollection) {
                logDescription = `Subscription paused (${pauseCollection.behavior})`;
            }

            // Log activity - ignore errors if table doesn't exist
            await supabase.from('client_activity_logs').insert({
                client_id: sub.client_id,
                action: 'subscription_updated',
                details: logDescription,
                performed_by: null, // System action
            });
        }

        console.log(`[Subscription Webhook] Successfully updated ${stripeSubscriptionId}`);
    } catch (error) {
        console.error('[Subscription Webhook] Error in handleSubscriptionUpdated:', error);
    }
}

/**
 * Handle subscription deletion (cancellation) from Stripe
 */
export async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    const supabase = createAdminClient();
    const stripeSubscriptionId = subscription.id;

    console.log(`[Subscription Webhook] Processing deletion for ${stripeSubscriptionId}`);

    try {
        // Update subscription status
        const { error } = await supabase
            .from('subscriptions')
            .update({
                status: 'canceled',
                cancelled_at: new Date().toISOString(),
                cancel_at_period_end: false, // Already cancelled
                updated_at: new Date().toISOString(),
            })
            .eq('stripe_subscription_id', stripeSubscriptionId);

        if (error) {
            console.error('[Subscription Webhook] Failed to update cancelled subscription:', error);
        }

        // Mark any pending approval requests as completed
        await supabase
            .from('approval_requests')
            .update({
                status: 'approved',
                resolution_notes: 'Subscription cancelled via Stripe',
                resolved_at: new Date().toISOString(),
            })
            .eq('stripe_subscription_id', stripeSubscriptionId)
            .eq('status', 'pending');

        // Cancel any active freezes
        await supabase
            .from('subscription_freezes')
            .update({
                status: 'cancelled',
            })
            .eq('stripe_subscription_id', stripeSubscriptionId)
            .in('status', ['pending', 'active']);

        // Get client for activity log
        const { data: sub } = await supabase
            .from('subscriptions')
            .select('client_id')
            .eq('stripe_subscription_id', stripeSubscriptionId)
            .single();

        if (sub?.client_id) {
            // Update client status if needed
            await supabase
                .from('clients')
                .update({
                    status: 'inactive',
                })
                .eq('id', sub.client_id)
                .eq('status', 'active'); // Only update if currently active

            // Log the cancellation
            await supabase.from('client_activity_logs').insert({
                client_id: sub.client_id,
                action: 'subscription_cancelled',
                details: 'Subscription was cancelled',
                performed_by: null,
            });
        }

        console.log(`[Subscription Webhook] Successfully processed deletion for ${stripeSubscriptionId}`);
    } catch (error) {
        console.error('[Subscription Webhook] Error in handleSubscriptionDeleted:', error);
    }
}

/**
 * Handle failed invoice payments
 */
export async function handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const supabase = createAdminClient();
    const invoiceAny = invoice as any;

    // Only handle subscription invoices
    if (!invoiceAny.subscription) {
        console.log('[Subscription Webhook] Ignoring non-subscription invoice');
        return;
    }

    const stripeSubscriptionId = typeof invoiceAny.subscription === 'string'
        ? invoiceAny.subscription
        : invoiceAny.subscription.id;

    console.log(`[Subscription Webhook] Processing failed payment for subscription ${stripeSubscriptionId}`);

    try {
        // Find the subscription and client
        const { data: subscription } = await supabase
            .from('subscriptions')
            .select('id, client_id')
            .eq('stripe_subscription_id', stripeSubscriptionId)
            .single();

        if (!subscription?.client_id) {
            // Try to find by customer ID
            const customerId = typeof invoiceAny.customer === 'string'
                ? invoiceAny.customer
                : invoiceAny.customer?.id;

            if (customerId) {
                const { data: client } = await supabase
                    .from('clients')
                    .select('id, name')
                    .eq('stripe_customer_id', customerId)
                    .single();

                if (client) {
                    const amount = (invoiceAny.amount_due || 0) / 100;
                    const failureReason = invoiceAny.last_finalization_error?.message
                        || 'Payment method declined';

                    await notifyOfPaymentFailure(
                        client.id,
                        client.name,
                        amount,
                        failureReason
                    );
                }
            }
            return;
        }

        // Get client details
        const { data: client } = await supabase
            .from('clients')
            .select('name')
            .eq('id', subscription.client_id)
            .single();

        const clientName = client?.name || 'Unknown Client';
        const amount = (invoiceAny.amount_due || 0) / 100;
        const failureReason = invoiceAny.last_finalization_error?.message
            || 'Payment method declined';

        // Send notifications
        await notifyOfPaymentFailure(
            subscription.client_id,
            clientName,
            amount,
            failureReason
        );

        // Update subscription status if needed
        await supabase
            .from('subscriptions')
            .update({
                status: 'past_due',
                updated_at: new Date().toISOString(),
            })
            .eq('stripe_subscription_id', stripeSubscriptionId);

        // Log the failure
        await supabase.from('client_activity_logs').insert({
            client_id: subscription.client_id,
            action: 'payment_failed',
            details: `Payment of $${amount.toFixed(2)} failed: ${failureReason}`,
            performed_by: null,
        });

        console.log(`[Subscription Webhook] Processed failed payment for ${clientName}`);
    } catch (error) {
        console.error('[Subscription Webhook] Error in handleInvoicePaymentFailed:', error);
    }
}
