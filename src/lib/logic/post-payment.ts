/**
 * Post-Payment Flow Orchestrator
 *
 * Handles all post-payment actions after a checkout is completed:
 * 1. Slack channel celebration
 * 2. Slack DMs to team members
 * 3. Internal notifications to all involved parties + admins
 *
 * Note: GHL Agreement is now manual - triggered via button on client profile
 */

import { createAdminClient } from '@/lib/supabase/admin'
import {
    postToSalesChannel,
    sendDirectMessage,
    isSlackConfigured,
} from '@/lib/slack/client'
import {
    buildSaleCelebration,
    buildCommissionDM,
    buildNewClientAssignmentDM,
    buildPipelineFailureAlert,
    type SaleContext,
} from '@/lib/slack/messages'

export interface PostPaymentContext {
    clientId: string
    clientName: string
    clientEmail: string
    clientGoal: string | null
    programName: string
    paymentAmount: number // Initial payment just collected
    totalProgramValue: number // Total value of the full program
    cashCollected: number // Total cash collected so far (including this payment)
    programLengthMonths: number | null // Program duration in months
    paymentType: 'paid_in_full' | 'split' | 'subscription' | null
    closerId: string | null
    setterId: string | null
    referrerId: string | null
    coachId: string | null
    commissions: CommissionInfo[]
}

export interface CommissionInfo {
    userId: string
    role: 'closer' | 'setter' | 'referrer' | 'coach'
    amount: number
}

interface FailedStep {
    step: string
    error: string
}

interface UserWithSlack {
    id: string
    name: string
    slack_user_id: string | null
}

/**
 * Execute the complete post-payment flow
 * This runs asynchronously and handles errors gracefully
 */
export async function executePostPaymentFlow(
    context: PostPaymentContext
): Promise<{ success: boolean; failures: FailedStep[] }> {
    const failures: FailedStep[] = []
    const supabase = createAdminClient()

    console.log(`[Post-Payment] Starting flow for client: ${context.clientName}`)

    // Fetch user details for team members (names and slack IDs)
    const userIds = [
        context.closerId,
        context.setterId,
        context.referrerId,
        context.coachId,
    ].filter(Boolean) as string[]

    const { data: users } = await supabase
        .from('users')
        .select('id, name, slack_user_id')
        .in('id', userIds)

    const userMap = new Map<string, UserWithSlack>()
    users?.forEach((u) => userMap.set(u.id, u))

    const getName = (id: string | null): string | null => {
        if (!id) return null
        return userMap.get(id)?.name || null
    }

    const getSlackId = (id: string | null): string | null => {
        if (!id) return null
        return userMap.get(id)?.slack_user_id || null
    }

    // Build sale context for Slack messages
    const saleContext: SaleContext = {
        clientName: context.clientName,
        clientEmail: context.clientEmail,
        clientGoal: context.clientGoal,
        programName: context.programName,
        paymentAmount: context.paymentAmount,
        totalProgramValue: context.totalProgramValue,
        cashCollected: context.cashCollected,
        programLengthMonths: context.programLengthMonths,
        paymentType: context.paymentType,
        closerName: getName(context.closerId),
        coachName: getName(context.coachId),
        setterName: getName(context.setterId),
        referrerName: getName(context.referrerId),
        clientId: context.clientId,
    }

    // 1. SLACK CHANNEL CELEBRATION
    if (isSlackConfigured()) {
        try {
            const celebrationMessage = buildSaleCelebration(saleContext)
            const result = await postToSalesChannel(celebrationMessage)

            if (!result.success) {
                failures.push({ step: 'slack_channel', error: result.error || 'Unknown error' })
                await enqueueWebhookJob(supabase, 'slack_channel', {
                    type: 'celebration',
                    context: saleContext,
                }, context.clientId)
            } else {
                console.log('[Post-Payment] Slack celebration posted successfully')
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error'
            failures.push({ step: 'slack_channel', error: errorMsg })
            await enqueueWebhookJob(supabase, 'slack_channel', {
                type: 'celebration',
                context: saleContext,
            }, context.clientId)
        }
    }

    // 2. SLACK DMs TO TEAM MEMBERS
    if (isSlackConfigured()) {
        // Send DMs for commission earners
        for (const commission of context.commissions) {
            const slackUserId = getSlackId(commission.userId)

            if (slackUserId) {
                try {
                    const dmMessage = buildCommissionDM({
                        clientName: context.clientName,
                        amount: commission.amount,
                        role: commission.role,
                        programName: context.programName,
                    })

                    const result = await sendDirectMessage(slackUserId, dmMessage)

                    if (!result.success) {
                        console.warn(`[Post-Payment] Failed to send DM to ${commission.role}:`, result.error)
                        // Don't treat DM failures as critical - they have in-app notifications
                    }
                } catch (error) {
                    console.warn(`[Post-Payment] DM error for ${commission.role}:`, error)
                }
            }
        }

        // Special DM for coach about new client assignment (separate from commission)
        const coachSlackId = getSlackId(context.coachId)
        if (coachSlackId && context.coachId) {
            try {
                const assignmentMessage = buildNewClientAssignmentDM(
                    context.clientName,
                    context.programName
                )
                await sendDirectMessage(coachSlackId, assignmentMessage)
            } catch (error) {
                console.warn('[Post-Payment] Coach assignment DM error:', error)
            }
        }
    }

    // 3. INTERNAL NOTIFICATIONS
    try {
        await createSaleNotifications(supabase, context, userMap)
        console.log('[Post-Payment] Internal notifications created')
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        failures.push({ step: 'internal_notifications', error: errorMsg })
    }

    // 4. ALERT ADMINS IF FAILURES
    if (failures.length > 0) {
        console.warn('[Post-Payment] Flow had failures:', failures)

        // Create admin notification
        await supabase.from('feature_notifications').insert({
            type: 'pipeline_failure',
            category: 'alert',
            message: `Post-payment flow issues for ${context.clientName}: ${failures.map(f => f.step).join(', ')}`,
            target_role: 'admin',
            is_read: false,
        })

        // Send Slack alert to admins if configured
        if (isSlackConfigured()) {
            try {
                const alertMessage = buildPipelineFailureAlert(context.clientName, failures)
                await postToSalesChannel(alertMessage) // Or a separate admin channel
            } catch (error) {
                console.error('[Post-Payment] Failed to send admin alert:', error)
            }
        }
    }

    console.log(`[Post-Payment] Flow completed for ${context.clientName}. Failures: ${failures.length}`)

    return { success: failures.length === 0, failures }
}

/**
 * Create internal notifications for all involved parties
 */
async function createSaleNotifications(
    supabase: ReturnType<typeof createAdminClient>,
    context: PostPaymentContext,
    userMap: Map<string, UserWithSlack>
): Promise<void> {
    const notifications: Array<{
        user_id?: string
        target_role?: string
        type: string
        category: string
        message: string
        amount?: number
        is_read: boolean
    }> = []

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
        }).format(amount)

    // Notifications for commission earners
    for (const commission of context.commissions) {
        const roleMessages: Record<string, string> = {
            closer: `You closed ${context.clientName}! Commission: ${formatCurrency(commission.amount)}`,
            setter: `${context.clientName} converted! Commission: ${formatCurrency(commission.amount)}`,
            referrer: `Your referral ${context.clientName} signed! Bonus: ${formatCurrency(commission.amount)}`,
            coach: `New client: ${context.clientName} - ${context.programName}. Commission: ${formatCurrency(commission.amount)}`,
        }

        notifications.push({
            user_id: commission.userId,
            type: 'sale_closed',
            category: 'commission',
            message: roleMessages[commission.role] || `Commission earned: ${formatCurrency(commission.amount)}`,
            amount: commission.amount,
            is_read: false,
        })
    }

    // New client assignment notification for coach (if not already in commissions)
    if (context.coachId && !context.commissions.find(c => c.userId === context.coachId)) {
        notifications.push({
            user_id: context.coachId,
            type: 'new_client_assigned',
            category: 'client',
            message: `New client assigned: ${context.clientName} - ${context.programName}`,
            is_read: false,
        })
    }

    // Admin broadcast notification
    notifications.push({
        target_role: 'admin',
        type: 'sale_closed',
        category: 'sales',
        message: `${context.clientName} signed for ${context.programName} (${formatCurrency(context.paymentAmount)})`,
        amount: context.paymentAmount,
        is_read: false,
    })

    // Insert all notifications
    if (notifications.length > 0) {
        const { error } = await supabase.from('feature_notifications').insert(notifications)

        if (error) {
            console.error('[Post-Payment] Failed to insert notifications:', error)
            throw error
        }
    }
}

/**
 * Enqueue a failed webhook job for retry
 */
async function enqueueWebhookJob(
    supabase: ReturnType<typeof createAdminClient>,
    jobType: 'slack_channel' | 'slack_dm',
    payload: unknown,
    clientId: string
): Promise<void> {
    const nextRetryAt = new Date(Date.now() + 60 * 1000) // Retry in 1 minute

    const { error } = await supabase.from('webhook_jobs').insert({
        job_type: jobType,
        status: 'pending',
        payload,
        client_id: clientId,
        next_retry_at: nextRetryAt.toISOString(),
    })

    if (error) {
        console.error('[Post-Payment] Failed to enqueue webhook job:', error)
    }
}

/**
 * Helper to extract commission data from calculateCommission result
 * This is called from the Stripe webhook after commission calculation
 */
export function extractCommissionInfo(
    ledgerEntries: Array<{
        user_id: string
        split_role: string | null
        commission_amount: number
    }>
): CommissionInfo[] {
    return ledgerEntries.map((entry) => {
        let role: CommissionInfo['role'] = 'coach'
        if (entry.split_role === 'closer') role = 'closer'
        else if (entry.split_role === 'setter') role = 'setter'
        else if (entry.split_role === 'referrer') role = 'referrer'

        return {
            userId: entry.user_id,
            role,
            amount: entry.commission_amount,
        }
    })
}
