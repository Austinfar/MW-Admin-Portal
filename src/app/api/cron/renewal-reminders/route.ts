import { NextResponse } from 'next/server'
import { format } from 'date-fns'
import {
    getClientsNeedingReminders,
    getExpiringClients,
    markReminderSent,
} from '@/lib/actions/renewals'
import {
    buildRenewalChannelReminder,
    buildRenewalCoachDM,
    buildDailyRenewalSummary,
    type RenewalContext,
} from '@/lib/slack/messages'
import {
    postToRenewalChannel,
    sendDirectMessage,
    isRenewalChannelConfigured,
} from '@/lib/slack/client'

export const dynamic = 'force-dynamic'

const DASHBOARD_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.mwfitnesscoaching.com'

/**
 * Cron job to send renewal reminders
 * Runs daily at 9 AM (configured in vercel.json)
 *
 * Sends:
 * 1. Daily summary to renewal channel
 * 2. Individual reminders at 30, 14, and 7 day marks
 * 3. DMs to assigned coaches
 */
export async function GET(request: Request) {
    // Verify cron secret if configured
    const authHeader = request.headers.get('authorization')
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new Response('Unauthorized', { status: 401 })
    }

    console.log('[Renewal Reminders] Starting cron job...')

    if (!isRenewalChannelConfigured()) {
        console.warn('[Renewal Reminders] Slack renewal channel not configured')
        return NextResponse.json({
            success: false,
            error: 'Slack renewal channel not configured',
        })
    }

    const results = {
        dailySummary: false,
        remindersProcessed: 0,
        remindersSent: 0,
        coachDMsSent: 0,
        errors: [] as string[],
    }

    try {
        // 1. Send daily summary
        const allExpiring = await getExpiringClients({ daysAhead: 30 })

        if (allExpiring.length > 0) {
            const summaryContext = allExpiring.map(client => ({
                clientId: client.clientId,
                clientName: client.clientName,
                clientEmail: client.clientEmail,
                coachName: client.coachName,
                coachSlackId: null,
                programName: client.programName,
                contractEndDate: format(new Date(client.contractEndDate), 'MMM d, yyyy'),
                daysUntilExpiration: client.daysUntilExpiration,
                totalValue: null,
                monthlyRate: null,
                contractNumber: client.contractNumber,
                dashboardUrl: `${DASHBOARD_BASE_URL}/renewals`,
            }))

            const summaryMessage = buildDailyRenewalSummary(
                summaryContext,
                `${DASHBOARD_BASE_URL}/renewals`
            )

            const summaryResult = await postToRenewalChannel(summaryMessage)
            results.dailySummary = summaryResult.success

            if (!summaryResult.success) {
                results.errors.push(`Daily summary failed: ${summaryResult.error}`)
            }
        }

        // 2. Get clients needing specific reminders
        const { thirtyDay, fourteenDay, sevenDay } = await getClientsNeedingReminders()

        // Process each reminder tier
        const reminderBatches = [
            { clients: thirtyDay, type: '30_day' as const },
            { clients: fourteenDay, type: '14_day' as const },
            { clients: sevenDay, type: '7_day' as const },
        ]

        for (const batch of reminderBatches) {
            for (const client of batch.clients) {
                results.remindersProcessed++

                // Build context for messages
                const context: RenewalContext = {
                    clientId: client.clientId,
                    clientName: client.clientName,
                    clientEmail: client.clientEmail,
                    coachName: client.coachName,
                    coachSlackId: (client as { coachSlackId?: string | null }).coachSlackId || null,
                    programName: client.programName,
                    contractEndDate: format(new Date(client.contractEndDate), 'MMM d, yyyy'),
                    daysUntilExpiration: client.daysUntilExpiration,
                    totalValue: (client as { totalValue?: number | null }).totalValue || null,
                    monthlyRate: (client as { monthlyRate?: number | null }).monthlyRate || null,
                    contractNumber: client.contractNumber,
                    dashboardUrl: `${DASHBOARD_BASE_URL}/clients/${client.clientId}`,
                }

                // Post to renewal channel
                const channelMessage = buildRenewalChannelReminder(context)
                const channelResult = await postToRenewalChannel(channelMessage)

                if (channelResult.success) {
                    results.remindersSent++

                    // Mark reminder as sent
                    await markReminderSent(client.clientId, batch.type)

                    // Send DM to coach if they have a Slack ID
                    if (context.coachSlackId) {
                        const coachMessage = buildRenewalCoachDM(context)
                        const dmResult = await sendDirectMessage(context.coachSlackId, coachMessage)

                        if (dmResult.success) {
                            results.coachDMsSent++
                        } else {
                            console.warn(`[Renewal Reminders] Failed to DM coach for ${client.clientName}: ${dmResult.error}`)
                        }
                    }
                } else {
                    results.errors.push(`Failed to send reminder for ${client.clientName}: ${channelResult.error}`)
                }
            }
        }

        console.log('[Renewal Reminders] Completed:', results)

        return NextResponse.json({
            success: true,
            ...results,
        })
    } catch (error) {
        console.error('[Renewal Reminders] Error:', error)
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                ...results,
            },
            { status: 500 }
        )
    }
}
