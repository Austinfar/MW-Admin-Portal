'use server';

import { stripe } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import Stripe from 'stripe';

export interface SubscriptionConfig {
    id: string;
    stripe_subscription_id: string;
    client_id: string | null;
    assigned_coach_id: string | null;
    appointment_setter_id: string | null;
    commission_splits: Array<{ userId: string; role: string; percentage?: number }> | null;
    lead_source: 'coach_driven' | 'company_driven' | null;
    is_resign: boolean;
    is_active: boolean;
    created_at: string;
    // Joined data
    client?: { id: string; name: string; email: string } | null;
    coach?: { id: string; name: string } | null;
}

export interface StripeSubscriptionWithConfig {
    id: string;
    status: Stripe.Subscription.Status;
    customer: string;
    customer_email: string | null;
    customer_name: string | null;
    current_period_end: Date;
    cancel_at_period_end: boolean;
    plan_name: string;
    amount: number;
    currency: string;
    interval: string;
    created: Date;
    // From our DB
    config?: SubscriptionConfig | null;
    client?: { id: string; name: string; email: string } | null;
}

/**
 * Fetch all active Stripe subscriptions with their commission configs
 */
export async function getSubscriptionsWithConfigs(): Promise<{
    subscriptions: StripeSubscriptionWithConfig[];
    error?: string;
}> {
    const supabase = createAdminClient();

    try {
        // Fetch active subscriptions from Stripe
        const stripeSubscriptions = await stripe.subscriptions.list({
            status: 'active',
            limit: 100,
            expand: ['data.customer', 'data.plan.product'],
        });

        // Fetch all subscription configs from our DB
        const { data: configs } = await supabase
            .from('subscription_commission_config')
            .select(`
                *,
                client:clients(id, name, email),
                coach:users!assigned_coach_id(id, name)
            `);

        const configMap = new Map(
            (configs || []).map((c: any) => [c.stripe_subscription_id, c])
        );

        // Fetch clients by stripe_customer_id for matching
        const customerIds = stripeSubscriptions.data.map(s =>
            typeof s.customer === 'string' ? s.customer : s.customer.id
        );

        const { data: clients } = await supabase
            .from('clients')
            .select('id, name, email, stripe_customer_id')
            .in('stripe_customer_id', customerIds);

        const clientByCustomerId = new Map(
            (clients || []).map(c => [c.stripe_customer_id, c])
        );

        // Map Stripe subscriptions to our format
        const subscriptions: StripeSubscriptionWithConfig[] = stripeSubscriptions.data.map(sub => {
            const customer = sub.customer as Stripe.Customer;
            const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
            const config = configMap.get(sub.id) as SubscriptionConfig | undefined;
            const matchedClient = clientByCustomerId.get(customerId);

            // Get plan info
            // Use sub.plan which is expanded via 'data.plan.product'
            // Cast to any because standard Stripe types don't always include the top-level plan object resulting from expansion
            const plan = (sub as any).plan;
            const product = plan?.product as Stripe.Product | undefined;

            // Fallback to items price if needed for amount/interval (usually same as plan)
            const priceData = sub.items.data[0]?.price;

            return {
                id: sub.id,
                status: sub.status,
                customer: customerId,
                customer_email: customer?.email || null,
                customer_name: customer?.name || null,
                current_period_end: new Date((sub as any).current_period_end * 1000),
                cancel_at_period_end: sub.cancel_at_period_end,
                plan_name: product?.name || 'Unknown Plan',
                amount: (priceData?.unit_amount || 0) / 100,
                currency: priceData?.currency || 'usd',
                interval: priceData?.recurring?.interval || 'month',
                created: new Date(sub.created * 1000),
                config: config || null,
                client: config?.client || matchedClient || null,
            };
        });

        return { subscriptions };
    } catch (error: any) {
        console.error('[getSubscriptionsWithConfigs] Error:', error);
        return { subscriptions: [], error: error.message };
    }
}

/**
 * Link a Stripe subscription to a client and set up commission config
 */
export async function linkSubscriptionToClient(
    subscriptionId: string,
    payload: {
        clientId: string;
        coachId?: string;
        setterId?: string;
        commissionSplits?: Array<{ userId: string; role: string; percentage?: number }>;
        leadSource: 'coach_driven' | 'company_driven';
        isResign?: boolean;
    }
): Promise<{ success?: boolean; error?: string }> {
    const supabase = createAdminClient();

    try {
        // Verify subscription exists in Stripe
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        if (!subscription) {
            return { error: 'Subscription not found in Stripe' };
        }

        // Verify client exists
        const { data: client, error: clientError } = await supabase
            .from('clients')
            .select('id, stripe_customer_id')
            .eq('id', payload.clientId)
            .single();

        if (clientError || !client) {
            return { error: 'Client not found' };
        }

        // Update client's stripe_customer_id if not set
        const customerId = typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer;

        if (!client.stripe_customer_id || client.stripe_customer_id !== customerId) {
            await supabase
                .from('clients')
                .update({ stripe_customer_id: customerId })
                .eq('id', payload.clientId);
        }

        // Upsert subscription commission config
        const { error: configError } = await supabase
            .from('subscription_commission_config')
            .upsert({
                stripe_subscription_id: subscriptionId,
                client_id: payload.clientId,
                assigned_coach_id: payload.coachId || null,
                appointment_setter_id: payload.setterId || null,
                commission_splits: payload.commissionSplits || [],
                lead_source: payload.leadSource,
                is_resign: payload.isResign || false,
                is_active: true,
                updated_at: new Date().toISOString(),
            }, {
                onConflict: 'stripe_subscription_id',
            });

        if (configError) {
            console.error('[linkSubscriptionToClient] Config error:', configError);
            return { error: configError.message };
        }

        // Update client's assigned_coach_id if provided
        if (payload.coachId) {
            await supabase
                .from('clients')
                .update({
                    assigned_coach_id: payload.coachId,
                    lead_source: payload.leadSource,
                    is_resign: payload.isResign || false,
                })
                .eq('id', payload.clientId);
        }

        return { success: true };
    } catch (error: any) {
        console.error('[linkSubscriptionToClient] Error:', error);
        return { error: error.message };
    }
}

/**
 * Unlink a subscription from commission tracking
 */
export async function unlinkSubscription(subscriptionId: string): Promise<{ success?: boolean; error?: string }> {
    const supabase = createAdminClient();

    try {
        const { error } = await supabase
            .from('subscription_commission_config')
            .update({ is_active: false })
            .eq('stripe_subscription_id', subscriptionId);

        if (error) {
            return { error: error.message };
        }

        return { success: true };
    } catch (error: any) {
        return { error: error.message };
    }
}

/**
 * Get subscription config by subscription ID
 */
export async function getSubscriptionConfig(subscriptionId: string): Promise<{
    config?: SubscriptionConfig;
    error?: string;
}> {
    const supabase = createAdminClient();

    const { data, error } = await supabase
        .from('subscription_commission_config')
        .select(`
            *,
            client:clients(id, name, email),
            coach:users!assigned_coach_id(id, name)
        `)
        .eq('stripe_subscription_id', subscriptionId)
        .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        return { error: error.message };
    }

    return { config: data };
}

/**
 * Get unlinked subscriptions (subscriptions without a commission config or linked client)
 */
export async function getUnlinkedSubscriptions(): Promise<{
    subscriptions: StripeSubscriptionWithConfig[];
    error?: string;
}> {
    const result = await getSubscriptionsWithConfigs();

    if (result.error) {
        return result;
    }

    // Filter to only unlinked (no config or no client)
    const unlinked = result.subscriptions.filter(s => !s.config || !s.client);

    return { subscriptions: unlinked };
}
