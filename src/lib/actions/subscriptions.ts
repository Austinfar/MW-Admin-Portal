'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { stripe } from '@/lib/stripe';
import { revalidatePath } from 'next/cache';
import type {
    ClientSubscription,
    ApprovalRequest,
    SubscriptionFreeze,
    FreezeOption,
    PaymentScheduleWithCharges,
    PaymentScheduleSummary,
    FREEZE_DURATION_DAYS,
} from '@/types/subscription';

// ============================================
// HELPER FUNCTIONS
// ============================================

async function getCurrentUser() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');
    return user;
}

async function getUserProfile(userId: string) {
    const supabase = createAdminClient();
    const { data } = await supabase
        .from('users')
        .select('id, name, email, role, job_title, permissions, slack_user_id')
        .eq('id', userId)
        .single();
    return data;
}

export async function canManageSubscriptions(userId?: string): Promise<boolean> {
    try {
        let targetUserId = userId;
        if (!targetUserId) {
            const user = await getCurrentUser();
            targetUserId = user.id;
        }
        const profile = await getUserProfile(targetUserId);
        if (!profile) return false;
        return (
            profile.role === 'admin' ||
            profile.role === 'super_admin' ||
            profile.job_title === 'head_coach'
        );
    } catch {
        return false;
    }
}

async function isAdmin(userId: string): Promise<boolean> {
    const profile = await getUserProfile(userId);
    return profile?.role === 'admin' || profile?.role === 'super_admin';
}

// Freeze duration in days
const FREEZE_DAYS: Record<string, number> = {
    '1_week': 7,
    '2_weeks': 14,
    '1_month': 30,
};

// ============================================
// SUBSCRIPTION QUERIES
// ============================================

/**
 * Get the subscription for a client from our database
 */
export async function getClientSubscription(clientId: string): Promise<ClientSubscription | null> {
    const supabase = createAdminClient();

    // First get the client's stripe_customer_id
    const { data: client } = await supabase
        .from('clients')
        .select('stripe_customer_id')
        .eq('id', clientId)
        .single();

    if (!client?.stripe_customer_id) {
        return null;
    }

    // Look for subscription in our DB
    const { data: subscription } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('stripe_customer_id', client.stripe_customer_id)
        .in('status', ['active', 'trialing', 'past_due', 'paused'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (subscription) {
        return subscription as ClientSubscription;
    }

    // If not in DB, try to fetch from Stripe and sync
    try {
        const subscriptions = await stripe.subscriptions.list({
            customer: client.stripe_customer_id,
            status: 'all',
            limit: 1,
            expand: ['data.items.data.price.product'],
        });

        if (subscriptions.data.length > 0) {
            const stripeSub = subscriptions.data[0] as any;
            const price = stripeSub.items?.data?.[0]?.price;
            const product = price?.product as { name?: string } | null;
            const currentPeriodEnd = stripeSub.current_period_end;

            // Sync to DB
            const { data: synced } = await supabase
                .from('subscriptions')
                .upsert({
                    stripe_subscription_id: stripeSub.id,
                    stripe_customer_id: client.stripe_customer_id,
                    client_id: clientId,
                    status: stripeSub.status,
                    plan_name: product?.name || null,
                    amount: (price?.unit_amount || 0) / 100,
                    currency: price?.currency || 'usd',
                    interval: price?.recurring?.interval || 'month',
                    interval_count: price?.recurring?.interval_count || 1,
                    current_period_end: currentPeriodEnd
                        ? new Date(currentPeriodEnd * 1000).toISOString()
                        : null,
                    next_billing_date: currentPeriodEnd
                        ? new Date(currentPeriodEnd * 1000).toISOString()
                        : null,
                    cancel_at_period_end: stripeSub.cancel_at_period_end,
                    paused_at: stripeSub.pause_collection
                        ? new Date().toISOString()
                        : null,
                    resume_at: stripeSub.pause_collection?.resumes_at
                        ? new Date(stripeSub.pause_collection.resumes_at * 1000).toISOString()
                        : null,
                    updated_at: new Date().toISOString(),
                }, {
                    onConflict: 'stripe_subscription_id',
                })
                .select()
                .single();

            return synced as ClientSubscription;
        }
    } catch (error) {
        console.error('[getClientSubscription] Stripe error:', error);
    }

    return null;
}

/**
 * Get active freeze for a subscription by stripe subscription ID
 */
export async function getActiveFreezeBySubscription(stripeSubscriptionId: string): Promise<SubscriptionFreeze | null> {
    const supabase = createAdminClient();

    const { data } = await supabase
        .from('subscription_freezes')
        .select('*')
        .eq('stripe_subscription_id', stripeSubscriptionId)
        .in('status', ['pending', 'active'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    return data as SubscriptionFreeze | null;
}

/**
 * Get active freeze for a client
 */
export async function getActiveFreeze(clientId: string): Promise<SubscriptionFreeze | null> {
    const supabase = createAdminClient();

    const { data } = await supabase
        .from('subscription_freezes')
        .select('*')
        .eq('client_id', clientId)
        .in('status', ['pending', 'active'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    return data as SubscriptionFreeze | null;
}

// ============================================
// PAUSE/FREEZE ACTIONS
// ============================================

/**
 * Pause a subscription
 */
export async function pauseSubscription(
    stripeSubscriptionId: string,
    clientId: string,
    option: FreezeOption
): Promise<{ success: boolean; error?: string; freezeId?: string }> {
    try {
        const user = await getCurrentUser();
        const canManage = await canManageSubscriptions(user.id);

        if (!canManage) {
            return { success: false, error: 'You do not have permission to manage subscriptions' };
        }

        const supabase = createAdminClient();

        // Get current subscription from Stripe
        const subscriptionData = await stripe.subscriptions.retrieve(stripeSubscriptionId);
        const subscription = subscriptionData as any;
        const currentPeriodEnd = subscription.current_period_end;

        if (option.type === 'pause_at_period_end') {
            // Simple pause at end of period
            await stripe.subscriptions.update(stripeSubscriptionId, {
                pause_collection: { behavior: 'void' },
            });

            // Record the freeze
            const { data: freeze, error } = await supabase
                .from('subscription_freezes')
                .insert({
                    client_id: clientId,
                    stripe_subscription_id: stripeSubscriptionId,
                    freeze_type: 'pause_at_period_end',
                    freeze_duration_days: null,
                    status: 'active',
                    started_at: new Date().toISOString(),
                    original_period_end: currentPeriodEnd
                        ? new Date(currentPeriodEnd * 1000).toISOString()
                        : null,
                    created_by: user.id,
                })
                .select()
                .single();

            if (error) {
                console.error('[pauseSubscription] DB error:', error);
                return { success: false, error: 'Failed to record pause' };
            }

            // Update subscription record
            await supabase
                .from('subscriptions')
                .update({
                    paused_at: new Date().toISOString(),
                    pause_collection_behavior: 'void',
                    updated_at: new Date().toISOString(),
                })
                .eq('stripe_subscription_id', stripeSubscriptionId);

            revalidatePath(`/clients/${clientId}`);
            return { success: true, freezeId: freeze.id };

        } else {
            // Immediate freeze with duration
            const durationDays = FREEZE_DAYS[option.duration];
            const resumeDate = new Date();
            resumeDate.setDate(resumeDate.getDate() + durationDays);

            // Pause with specific resume date
            await stripe.subscriptions.update(stripeSubscriptionId, {
                pause_collection: {
                    behavior: 'void',
                    resumes_at: Math.floor(resumeDate.getTime() / 1000),
                },
            });

            // Calculate extended period end
            const originalPeriodEnd = currentPeriodEnd
                ? new Date(currentPeriodEnd * 1000)
                : new Date();
            const extendedPeriodEnd = new Date(originalPeriodEnd);
            extendedPeriodEnd.setDate(extendedPeriodEnd.getDate() + durationDays);

            // Record the freeze
            const { data: freeze, error } = await supabase
                .from('subscription_freezes')
                .insert({
                    client_id: clientId,
                    stripe_subscription_id: stripeSubscriptionId,
                    freeze_type: 'immediate_freeze',
                    freeze_duration_days: durationDays,
                    status: 'active',
                    started_at: new Date().toISOString(),
                    scheduled_resume_at: resumeDate.toISOString(),
                    original_period_end: originalPeriodEnd.toISOString(),
                    extended_period_end: extendedPeriodEnd.toISOString(),
                    created_by: user.id,
                })
                .select()
                .single();

            if (error) {
                console.error('[pauseSubscription] DB error:', error);
                return { success: false, error: 'Failed to record freeze' };
            }

            // Update subscription record
            await supabase
                .from('subscriptions')
                .update({
                    paused_at: new Date().toISOString(),
                    resume_at: resumeDate.toISOString(),
                    pause_collection_behavior: 'void',
                    updated_at: new Date().toISOString(),
                })
                .eq('stripe_subscription_id', stripeSubscriptionId);

            revalidatePath(`/clients/${clientId}`);
            return { success: true, freezeId: freeze.id };
        }
    } catch (error: any) {
        console.error('[pauseSubscription] Error:', error);
        return { success: false, error: error.message || 'Failed to pause subscription' };
    }
}

/**
 * Resume a paused subscription
 */
export async function resumeSubscription(
    freezeId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const user = await getCurrentUser();
        const canManage = await canManageSubscriptions(user.id);

        if (!canManage) {
            return { success: false, error: 'You do not have permission to manage subscriptions' };
        }

        const supabase = createAdminClient();

        // Get the freeze record
        const { data: freeze, error: fetchError } = await supabase
            .from('subscription_freezes')
            .select('*')
            .eq('id', freezeId)
            .single();

        if (fetchError || !freeze) {
            return { success: false, error: 'Freeze record not found' };
        }

        // Resume in Stripe
        const updateParams: any = {
            pause_collection: null as any, // Remove pause
        };

        // If this was an immediate freeze, extend the billing period
        if (freeze.freeze_type === 'immediate_freeze' && freeze.extended_period_end) {
            updateParams.trial_end = Math.floor(new Date(freeze.extended_period_end).getTime() / 1000);
        }

        await stripe.subscriptions.update(freeze.stripe_subscription_id, updateParams);

        // Update freeze record
        await supabase
            .from('subscription_freezes')
            .update({
                status: 'resumed',
                actual_resumed_at: new Date().toISOString(),
                resumed_by: user.id,
            })
            .eq('id', freezeId);

        // Update subscription record
        await supabase
            .from('subscriptions')
            .update({
                paused_at: null,
                resume_at: null,
                pause_collection_behavior: null,
                updated_at: new Date().toISOString(),
            })
            .eq('stripe_subscription_id', freeze.stripe_subscription_id);

        revalidatePath(`/clients/${freeze.client_id}`);
        return { success: true };
    } catch (error: any) {
        console.error('[resumeSubscription] Error:', error);
        return { success: false, error: error.message || 'Failed to resume subscription' };
    }
}

// ============================================
// CANCELLATION REQUEST ACTIONS
// ============================================

/**
 * Request subscription cancellation (creates approval request)
 */
export async function requestSubscriptionCancellation(
    stripeSubscriptionId: string,
    clientId: string,
    reason: string,
    additionalNotes?: string
): Promise<{ success: boolean; error?: string; requestId?: string }> {
    try {
        const user = await getCurrentUser();
        const canManage = await canManageSubscriptions(user.id);

        if (!canManage) {
            return { success: false, error: 'You do not have permission to manage subscriptions' };
        }

        if (!reason || reason.trim().length < 10) {
            return { success: false, error: 'Please provide a detailed reason (at least 10 characters)' };
        }

        const supabase = createAdminClient();

        // Check for existing pending request
        const { data: existing } = await supabase
            .from('approval_requests')
            .select('id')
            .eq('stripe_subscription_id', stripeSubscriptionId)
            .eq('status', 'pending')
            .single();

        if (existing) {
            return { success: false, error: 'A cancellation request is already pending for this subscription' };
        }

        // Create approval request
        const { data: request, error } = await supabase
            .from('approval_requests')
            .insert({
                request_type: 'subscription_cancel',
                status: 'pending',
                client_id: clientId,
                stripe_subscription_id: stripeSubscriptionId,
                requested_by: user.id,
                reason: reason.trim(),
                additional_notes: additionalNotes?.trim() || null,
            })
            .select()
            .single();

        if (error) {
            console.error('[requestSubscriptionCancellation] DB error:', error);
            return { success: false, error: 'Failed to create cancellation request' };
        }

        // Link request to subscription
        await supabase
            .from('subscriptions')
            .update({ pending_cancellation_request_id: request.id })
            .eq('stripe_subscription_id', stripeSubscriptionId);

        // Send notifications (imported separately)
        const { notifyAdminsOfCancellationRequest } = await import('./subscription-notifications');

        const profile = await getUserProfile(user.id);
        const { data: client } = await supabase
            .from('clients')
            .select('name')
            .eq('id', clientId)
            .single();

        await notifyAdminsOfCancellationRequest(
            client?.name || 'Unknown Client',
            profile?.name || 'Unknown',
            reason,
            request.id
        );

        revalidatePath(`/clients/${clientId}`);
        return { success: true, requestId: request.id };
    } catch (error: any) {
        console.error('[requestSubscriptionCancellation] Error:', error);
        return { success: false, error: error.message || 'Failed to request cancellation' };
    }
}

/**
 * Approve subscription cancellation (admin only)
 */
export async function approveSubscriptionCancellation(
    requestId: string,
    resolutionNotes?: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const user = await getCurrentUser();
        const isAdminUser = await isAdmin(user.id);

        if (!isAdminUser) {
            return { success: false, error: 'Only admins can approve cancellation requests' };
        }

        const supabase = createAdminClient();

        // Get the request
        const { data: request, error: fetchError } = await supabase
            .from('approval_requests')
            .select('*, client:clients(name)')
            .eq('id', requestId)
            .single();

        if (fetchError || !request) {
            return { success: false, error: 'Request not found' };
        }

        if (request.status !== 'pending') {
            return { success: false, error: 'Request has already been processed' };
        }

        // Cancel the subscription in Stripe (at period end)
        await stripe.subscriptions.update(request.stripe_subscription_id, {
            cancel_at_period_end: true,
        });

        // Update the request
        await supabase
            .from('approval_requests')
            .update({
                status: 'approved',
                resolved_by: user.id,
                resolved_at: new Date().toISOString(),
                resolution_notes: resolutionNotes?.trim() || null,
            })
            .eq('id', requestId);

        // Update subscription
        await supabase
            .from('subscriptions')
            .update({
                cancel_at_period_end: true,
                pending_cancellation_request_id: null,
                cancellation_reason: request.reason,
                updated_at: new Date().toISOString(),
            })
            .eq('stripe_subscription_id', request.stripe_subscription_id);

        // Notify requester
        const { notifyRequesterOfApprovalDecision } = await import('./subscription-notifications');
        await notifyRequesterOfApprovalDecision(
            request.requested_by,
            (request.client as any)?.name || 'Unknown Client',
            true,
            resolutionNotes
        );

        revalidatePath(`/clients/${request.client_id}`);
        return { success: true };
    } catch (error: any) {
        console.error('[approveSubscriptionCancellation] Error:', error);
        return { success: false, error: error.message || 'Failed to approve cancellation' };
    }
}

/**
 * Reject subscription cancellation (admin only)
 */
export async function rejectSubscriptionCancellation(
    requestId: string,
    resolutionNotes: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const user = await getCurrentUser();
        const isAdminUser = await isAdmin(user.id);

        if (!isAdminUser) {
            return { success: false, error: 'Only admins can reject cancellation requests' };
        }

        if (!resolutionNotes || resolutionNotes.trim().length < 10) {
            return { success: false, error: 'Please provide a reason for rejection (at least 10 characters)' };
        }

        const supabase = createAdminClient();

        // Get the request
        const { data: request, error: fetchError } = await supabase
            .from('approval_requests')
            .select('*, client:clients(name)')
            .eq('id', requestId)
            .single();

        if (fetchError || !request) {
            return { success: false, error: 'Request not found' };
        }

        if (request.status !== 'pending') {
            return { success: false, error: 'Request has already been processed' };
        }

        // Update the request
        await supabase
            .from('approval_requests')
            .update({
                status: 'rejected',
                resolved_by: user.id,
                resolved_at: new Date().toISOString(),
                resolution_notes: resolutionNotes.trim(),
            })
            .eq('id', requestId);

        // Clear pending request from subscription
        await supabase
            .from('subscriptions')
            .update({
                pending_cancellation_request_id: null,
                updated_at: new Date().toISOString(),
            })
            .eq('stripe_subscription_id', request.stripe_subscription_id);

        // Notify requester
        const { notifyRequesterOfApprovalDecision } = await import('./subscription-notifications');
        await notifyRequesterOfApprovalDecision(
            request.requested_by,
            (request.client as any)?.name || 'Unknown Client',
            false,
            resolutionNotes
        );

        revalidatePath(`/clients/${request.client_id}`);
        return { success: true };
    } catch (error: any) {
        console.error('[rejectSubscriptionCancellation] Error:', error);
        return { success: false, error: error.message || 'Failed to reject cancellation' };
    }
}

/**
 * Get pending approval requests (admin view)
 */
export async function getPendingApprovalRequests(): Promise<ApprovalRequest[]> {
    const supabase = createAdminClient();

    const { data, error } = await supabase
        .from('approval_requests')
        .select(`
            *,
            requester:users!requested_by(id, name, email),
            client:clients(id, name, email)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('[getPendingApprovalRequests] Error:', error);
        return [];
    }

    return (data || []) as ApprovalRequest[];
}

/**
 * Get approval requests for a specific client
 */
export async function getApprovalRequestsForClient(clientId: string): Promise<ApprovalRequest[]> {
    const supabase = createAdminClient();

    const { data, error } = await supabase
        .from('approval_requests')
        .select(`
            *,
            requester:users!requested_by(id, name, email),
            resolver:users!resolved_by(id, name, email)
        `)
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('[getApprovalRequestsForClient] Error:', error);
        return [];
    }

    return (data || []) as ApprovalRequest[];
}

// ============================================
// PAYMENT SCHEDULE QUERIES
// ============================================

/**
 * Get payment schedule summary for a client
 */
export async function getClientPaymentSchedule(clientId: string): Promise<PaymentScheduleSummary> {
    const supabase = createAdminClient();

    const { data: schedules, error } = await supabase
        .from('payment_schedules')
        .select(`
            *,
            scheduled_charges(*)
        `)
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('[getClientPaymentSchedule] Error:', error);
        return { schedules: [], totalValue: 0, totalPaid: 0, totalRemaining: 0 };
    }

    const schedulesWithCharges = (schedules || []) as PaymentScheduleWithCharges[];

    // Calculate totals
    let totalValue = 0;
    let totalPaid = 0;
    let totalRemaining = 0;

    for (const schedule of schedulesWithCharges) {
        totalValue += schedule.total_amount || 0;
        totalRemaining += schedule.remaining_amount || 0;

        // Calculate paid from charges
        const paidCharges = schedule.scheduled_charges?.filter(c => c.status === 'paid') || [];
        const paidFromCharges = paidCharges.reduce((sum, c) => sum + c.amount, 0);

        // Also add initial payment if schedule is active
        const initialPayment = schedule.status === 'active' ? (schedule.amount || 0) : 0;
        totalPaid += paidFromCharges + initialPayment;
    }

    return {
        schedules: schedulesWithCharges,
        totalValue,
        totalPaid,
        totalRemaining,
    };
}

/**
 * Update a scheduled charge (permission required)
 */
export async function updateScheduledCharge(
    chargeId: string,
    updates: { amount?: number; due_date?: string }
): Promise<{ success: boolean; error?: string }> {
    try {
        const user = await getCurrentUser();

        const supabase = createAdminClient();

        // Get user profile to check permission
        const profile = await getUserProfile(user.id);
        const canEdit =
            profile?.role === 'admin' ||
            profile?.role === 'super_admin' ||
            (profile?.permissions as any)?.can_manage_payment_schedules === true;

        if (!canEdit) {
            return { success: false, error: 'You do not have permission to edit payment schedules' };
        }

        // Get the charge to verify it's pending
        const { data: charge } = await supabase
            .from('scheduled_charges')
            .select('*, schedule:payment_schedules(client_id)')
            .eq('id', chargeId)
            .single();

        if (!charge) {
            return { success: false, error: 'Charge not found' };
        }

        if (charge.status !== 'pending') {
            return { success: false, error: 'Can only edit pending charges' };
        }

        // Update the charge
        const { error } = await supabase
            .from('scheduled_charges')
            .update({
                amount: updates.amount ?? charge.amount,
                due_date: updates.due_date ?? charge.due_date,
            })
            .eq('id', chargeId);

        if (error) {
            return { success: false, error: 'Failed to update charge' };
        }

        // Recalculate remaining amount on schedule
        if (updates.amount && updates.amount !== charge.amount) {
            const { data: allCharges } = await supabase
                .from('scheduled_charges')
                .select('amount, status')
                .eq('schedule_id', charge.schedule_id);

            const pendingTotal = (allCharges || [])
                .filter(c => c.status === 'pending')
                .reduce((sum, c) => sum + c.amount, 0);

            await supabase
                .from('payment_schedules')
                .update({ remaining_amount: pendingTotal })
                .eq('id', charge.schedule_id);
        }

        const clientId = (charge.schedule as any)?.client_id;
        if (clientId) {
            revalidatePath(`/clients/${clientId}`);
        }

        return { success: true };
    } catch (error: any) {
        console.error('[updateScheduledCharge] Error:', error);
        return { success: false, error: error.message || 'Failed to update charge' };
    }
}
