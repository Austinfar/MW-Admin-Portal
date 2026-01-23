'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { postToChannel, sendDirectMessage, isSlackConfigured } from '@/lib/slack/client';
import type { SlackMessage, SlackBlock } from '@/lib/slack/client';

/**
 * Format currency for display
 */
function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(amount);
}

/**
 * Build cancellation request alert message for Slack
 */
function buildCancellationRequestMessage(
    clientName: string,
    requesterName: string,
    reason: string
): SlackMessage {
    const blocks: SlackBlock[] = [
        {
            type: 'header',
            text: {
                type: 'plain_text',
                text: 'Subscription Cancellation Request',
                emoji: true,
            },
        },
        {
            type: 'section',
            fields: [
                { type: 'mrkdwn', text: `*Client:*\n${clientName}` },
                { type: 'mrkdwn', text: `*Requested By:*\n${requesterName}` },
            ],
        },
        {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `*Reason:*\n${reason}`,
            },
        },
        {
            type: 'context',
            elements: [
                {
                    type: 'mrkdwn',
                    text: '_Please review and approve/reject in the dashboard._',
                },
            ],
        } as unknown as SlackBlock,
    ];

    return {
        text: `Subscription cancellation requested for ${clientName} by ${requesterName}`,
        blocks,
    };
}

/**
 * Build payment failed alert message for Slack
 */
function buildPaymentFailedMessage(
    clientName: string,
    amount: number,
    failureReason: string
): SlackMessage {
    return {
        text: `Payment failed for ${clientName}: ${formatCurrency(amount)}`,
        blocks: [
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `*Payment Failed*\n\nClient: *${clientName}*\nAmount: *${formatCurrency(amount)}*\nReason: ${failureReason}`,
                },
            },
        ],
    };
}

/**
 * Notify all admins of a cancellation request
 */
export async function notifyAdminsOfCancellationRequest(
    clientName: string,
    requesterName: string,
    reason: string,
    requestId: string
): Promise<void> {
    const supabase = createAdminClient();

    try {
        // Create in-app notifications for all admins
        await supabase.from('feature_notifications').insert({
            target_role: 'admin',
            type: 'subscription_cancel_requested',
            category: 'alert',
            message: `${requesterName} requested cancellation for ${clientName}: ${reason.substring(0, 100)}${reason.length > 100 ? '...' : ''}`,
            is_read: false,
            metadata: { requestId },
        });

        // Also notify super_admins explicitly
        await supabase.from('feature_notifications').insert({
            target_role: 'super_admin',
            type: 'subscription_cancel_requested',
            category: 'alert',
            message: `${requesterName} requested cancellation for ${clientName}: ${reason.substring(0, 100)}${reason.length > 100 ? '...' : ''}`,
            is_read: false,
            metadata: { requestId },
        });

        // Send Slack notification if configured
        if (isSlackConfigured()) {
            const message = buildCancellationRequestMessage(clientName, requesterName, reason);

            // Get admin Slack channel from env or use sales channel as fallback
            const adminChannelId = process.env.SLACK_ADMIN_CHANNEL_ID || process.env.SLACK_SALES_CHANNEL_ID;

            if (adminChannelId) {
                await postToChannel(adminChannelId, message);
            }

            // Also DM all admins who have Slack connected
            const { data: admins } = await supabase
                .from('users')
                .select('slack_user_id')
                .in('role', ['admin', 'super_admin'])
                .not('slack_user_id', 'is', null);

            for (const admin of admins || []) {
                if (admin.slack_user_id) {
                    await sendDirectMessage(admin.slack_user_id, message);
                }
            }
        }
    } catch (error) {
        console.error('[notifyAdminsOfCancellationRequest] Error:', error);
        // Don't throw - notifications failing shouldn't break the request flow
    }
}

/**
 * Notify the requester of an approval decision
 */
export async function notifyRequesterOfApprovalDecision(
    requesterId: string,
    clientName: string,
    approved: boolean,
    resolutionNotes?: string
): Promise<void> {
    const supabase = createAdminClient();

    try {
        const status = approved ? 'approved' : 'rejected';
        const message = approved
            ? `Your cancellation request for ${clientName} has been approved. The subscription will cancel at the end of the current billing period.`
            : `Your cancellation request for ${clientName} has been rejected. Reason: ${resolutionNotes || 'No reason provided'}`;

        // Create in-app notification
        await supabase.from('feature_notifications').insert({
            user_id: requesterId,
            type: approved ? 'subscription_cancel_approved' : 'subscription_cancel_rejected',
            category: 'subscription',
            message,
            is_read: false,
        });

        // Send Slack DM if configured
        if (isSlackConfigured()) {
            const { data: user } = await supabase
                .from('users')
                .select('slack_user_id')
                .eq('id', requesterId)
                .single();

            if (user?.slack_user_id) {
                const emoji = approved ? '' : '';
                await sendDirectMessage(user.slack_user_id, {
                    text: `${emoji} Cancellation ${status} for ${clientName}`,
                    blocks: [
                        {
                            type: 'section',
                            text: {
                                type: 'mrkdwn',
                                text: `${emoji} *Cancellation ${approved ? 'Approved' : 'Rejected'}*\n\n${message}`,
                            },
                        },
                    ],
                });
            }
        }
    } catch (error) {
        console.error('[notifyRequesterOfApprovalDecision] Error:', error);
    }
}

/**
 * Notify admins of a payment failure
 */
export async function notifyOfPaymentFailure(
    clientId: string,
    clientName: string,
    amount: number,
    failureReason: string
): Promise<void> {
    const supabase = createAdminClient();

    try {
        // Create in-app notifications
        await supabase.from('feature_notifications').insert({
            target_role: 'admin',
            type: 'subscription_payment_failed',
            category: 'alert',
            message: `Payment failed for ${clientName}: ${formatCurrency(amount)} - ${failureReason}`,
            is_read: false,
            metadata: { clientId, amount, failureReason },
        });

        // Create client alert
        await supabase.from('client_alerts').upsert({
            client_id: clientId,
            alert_type: 'payment_failed',
            severity: 'critical',
            title: 'Subscription Payment Failed',
            description: `${formatCurrency(amount)} payment failed: ${failureReason}`,
            is_resolved: false,
        }, {
            onConflict: 'client_id,alert_type',
        });

        // Send Slack notification
        if (isSlackConfigured()) {
            const message = buildPaymentFailedMessage(clientName, amount, failureReason);

            const adminChannelId = process.env.SLACK_ADMIN_CHANNEL_ID || process.env.SLACK_SALES_CHANNEL_ID;
            if (adminChannelId) {
                await postToChannel(adminChannelId, message);
            }
        }
    } catch (error) {
        console.error('[notifyOfPaymentFailure] Error:', error);
    }
}

/**
 * Notify when a subscription is paused
 */
export async function notifySubscriptionPaused(
    clientId: string,
    clientName: string,
    pausedBy: string,
    freezeType: 'pause_at_period_end' | 'immediate_freeze',
    durationDays?: number
): Promise<void> {
    const supabase = createAdminClient();

    try {
        const durationText = freezeType === 'pause_at_period_end'
            ? 'until end of billing period'
            : `for ${durationDays} days`;

        // Create in-app notification for admins
        await supabase.from('feature_notifications').insert({
            target_role: 'admin',
            type: 'subscription_paused',
            category: 'subscription',
            message: `${pausedBy} paused subscription for ${clientName} ${durationText}`,
            is_read: false,
            metadata: { clientId, freezeType, durationDays },
        });
    } catch (error) {
        console.error('[notifySubscriptionPaused] Error:', error);
    }
}

/**
 * Notify when a subscription is resumed
 */
export async function notifySubscriptionResumed(
    clientId: string,
    clientName: string,
    resumedBy: string
): Promise<void> {
    const supabase = createAdminClient();

    try {
        await supabase.from('feature_notifications').insert({
            target_role: 'admin',
            type: 'subscription_resumed',
            category: 'subscription',
            message: `${resumedBy} resumed subscription for ${clientName}`,
            is_read: false,
            metadata: { clientId },
        });
    } catch (error) {
        console.error('[notifySubscriptionResumed] Error:', error);
    }
}
