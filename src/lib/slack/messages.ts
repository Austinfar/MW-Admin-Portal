/**
 * Slack Message Builders
 * Creates rich Block Kit messages for various notification types
 */

import type { SlackBlock, SlackMessage } from './client'

export interface SaleContext {
    clientName: string
    clientEmail: string
    clientGoal: string | null
    programName: string
    paymentAmount: number // Initial payment collected
    totalProgramValue: number // Total value over full program
    cashCollected: number // Total cash collected so far
    programLengthMonths: number | null // Program duration in months
    paymentType: 'paid_in_full' | 'split' | 'subscription' | null
    closerName: string | null
    coachName: string | null
    setterName: string | null
    referrerName: string | null
    clientId: string
}

export interface CommissionContext {
    clientName: string
    amount: number
    role: 'closer' | 'setter' | 'referrer' | 'coach'
    programName: string
}

/**
 * Format currency for display (converts cents to dollars)
 */
function formatCurrency(amountInCents: number): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amountInCents / 100)
}

/**
 * Build a sale celebration message for the sales channel
 */
export function buildSaleCelebration(context: SaleContext): SlackMessage {
    const {
        clientName,
        programName,
        paymentAmount,
        totalProgramValue,
        cashCollected,
        programLengthMonths,
        paymentType,
        closerName,
        coachName,
        setterName,
        clientGoal,
    } = context

    // Format payment type for display
    const paymentTypeDisplay = paymentType === 'paid_in_full'
        ? '💰 Paid in Full'
        : paymentType === 'split'
            ? '📅 Split Payment'
            : paymentType === 'subscription'
                ? '🔄 Subscription'
                : null

    const blocks: SlackBlock[] = [
        // Header with celebration
        {
            type: 'header',
            text: {
                type: 'plain_text',
                text: '🎉 New Client Signed! 🎉',
                emoji: true,
            },
        },
        // Client and program info
        {
            type: 'section',
            fields: [
                {
                    type: 'mrkdwn',
                    text: `*Client:*\n${clientName}`,
                },
                {
                    type: 'mrkdwn',
                    text: `*Program:*\n${programName}`,
                },
            ],
        },
        // Financial details section
        {
            type: 'section',
            fields: [
                {
                    type: 'mrkdwn',
                    text: `*Total Program Value:*\n${formatCurrency(totalProgramValue)}`,
                },
                {
                    type: 'mrkdwn',
                    text: `*Cash Collected:*\n${formatCurrency(cashCollected)}`,
                },
                ...(programLengthMonths ? [{
                    type: 'mrkdwn' as const,
                    text: `*Program Length:*\n${programLengthMonths} month${programLengthMonths !== 1 ? 's' : ''}`,
                }] : []),
                ...(paymentTypeDisplay ? [{
                    type: 'mrkdwn' as const,
                    text: `*Payment Type:*\n${paymentTypeDisplay}`,
                }] : []),
            ],
        },
    ]

    // Team members section
    const teamMembers: string[] = []
    if (closerName) teamMembers.push(`*Closer:* ${closerName}`)
    if (coachName) teamMembers.push(`*Coach:* ${coachName}`)
    if (setterName) teamMembers.push(`*Setter:* ${setterName}`)

    if (teamMembers.length > 0) {
        blocks.push({
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: teamMembers.join('  |  '),
            },
        })
    }

    // Footer with timestamp
    blocks.push({
        type: 'context',
        elements: [
            {
                type: 'mrkdwn',
                text: `Closed on ${new Date().toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                })}`,
            },
        ],
    } as SlackBlock)

    return {
        text: `🎉 New client signed: ${clientName} for ${programName} (${formatCurrency(paymentAmount)})`,
        blocks,
    }
}

/**
 * Build a commission notification DM
 */
export function buildCommissionDM(context: CommissionContext): SlackMessage {
    const { clientName, amount, role, programName } = context

    const roleEmojis: Record<string, string> = {
        closer: '🎯',
        setter: '📅',
        referrer: '🤝',
        coach: '👋',
    }

    const roleMessages: Record<string, string> = {
        closer: `You closed *${clientName}*!`,
        setter: `*${clientName}* converted!`,
        referrer: `Your referral *${clientName}* signed!`,
        coach: `New client assigned: *${clientName}*`,
    }

    const emoji = roleEmojis[role] || '✨'
    const message = roleMessages[role] || `Commission earned from ${clientName}`

    const blocks: SlackBlock[] = [
        {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `${emoji} ${message}`,
            },
        },
        {
            type: 'section',
            fields: [
                {
                    type: 'mrkdwn',
                    text: `*Program:*\n${programName}`,
                },
                {
                    type: 'mrkdwn',
                    text: `*Commission:*\n${formatCurrency(amount)}`,
                },
            ],
        },
    ]

    // Add action link for coach
    if (role === 'coach') {
        blocks.push({
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: '_Check the dashboard for onboarding tasks._',
            },
        })
    }

    return {
        text: `${emoji} ${message} - ${formatCurrency(amount)} commission`,
        blocks,
    }
}

/**
 * Build a new client assignment notification for coach DM
 */
export function buildNewClientAssignmentDM(
    clientName: string,
    programName: string,
    dashboardUrl?: string
): SlackMessage {
    const blocks: SlackBlock[] = [
        {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `👋 *New client assigned to you!*\n\nYou've been assigned *${clientName}* for the *${programName}* program.`,
            },
        },
        {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: '📋 _Check the onboarding board to get started with their tasks._',
            },
        },
    ]

    if (dashboardUrl) {
        blocks.push({
            type: 'actions',
            elements: [
                {
                    type: 'button',
                    text: {
                        type: 'plain_text',
                        text: 'View Onboarding',
                        emoji: true,
                    },
                    url: dashboardUrl,
                } as unknown as SlackBlock,
            ],
        } as SlackBlock)
    }

    return {
        text: `👋 New client assigned: ${clientName} (${programName})`,
        blocks,
    }
}

/**
 * Build a pipeline failure alert for admins
 */
export function buildPipelineFailureAlert(
    clientName: string,
    failures: { step: string; error: string }[]
): SlackMessage {
    const failureList = failures
        .map((f) => `• *${f.step}:* ${f.error}`)
        .join('\n')

    const blocks: SlackBlock[] = [
        {
            type: 'header',
            text: {
                type: 'plain_text',
                text: '⚠️ Post-Payment Flow Issue',
                emoji: true,
            },
        },
        {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `Some post-payment actions failed for *${clientName}*:`,
            },
        },
        {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: failureList,
            },
        },
        {
            type: 'context',
            elements: [
                {
                    type: 'mrkdwn',
                    text: '_Failed jobs have been queued for retry._',
                },
            ],
        } as SlackBlock,
    ]

    return {
        text: `⚠️ Post-payment flow issue for ${clientName}`,
        blocks,
    }
}
