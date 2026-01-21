import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { postToSalesChannel, sendDirectMessage } from '@/lib/slack/client'
import { buildSaleCelebration, type SaleContext } from '@/lib/slack/messages'

export const dynamic = 'force-dynamic'

interface WebhookJob {
    id: string
    job_type: 'slack_channel' | 'slack_dm'
    status: string
    payload: {
        type?: string
        context?: SaleContext
        slackUserId?: string
        message?: unknown
    }
    retry_count: number
    max_retries: number
    client_id: string | null
    created_at: string
}

/**
 * Webhook Retry Cron Job
 *
 * Processes failed webhook jobs with exponential backoff:
 * - Retry 1: 1 minute after failure
 * - Retry 2: 5 minutes after failure
 * - Retry 3: 15 minutes after failure
 * - After 3 failures: marked as 'dead' and admin notified
 *
 * Run via Vercel cron every 5 minutes:
 * vercel.json: { "crons": [{ "path": "/api/cron/webhook-retry", "schedule": "*/5 * * * *" }] }
 */
export async function GET(request: Request) {
    const supabase = createAdminClient()

    // Optional: Add authentication for production
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        // Fetch pending jobs that are ready for retry
        const { data: jobs, error: fetchError } = await supabase
            .from('webhook_jobs')
            .select('*')
            .eq('status', 'pending')
            .lt('next_retry_at', new Date().toISOString())
            .lt('retry_count', 3)
            .order('created_at', { ascending: true })
            .limit(10) // Process in batches

        if (fetchError) {
            console.error('[Webhook Retry] Error fetching jobs:', fetchError)
            return NextResponse.json({ error: 'Database error' }, { status: 500 })
        }

        if (!jobs || jobs.length === 0) {
            return NextResponse.json({ processed: 0, message: 'No jobs to process' })
        }

        const results = {
            processed: 0,
            succeeded: 0,
            failed: 0,
            dead: 0,
        }

        for (const job of jobs as WebhookJob[]) {
            // Mark job as processing
            await supabase
                .from('webhook_jobs')
                .update({ status: 'processing' })
                .eq('id', job.id)

            let success = false

            try {
                success = await processJob(job)
            } catch (error) {
                console.error(`[Webhook Retry] Job ${job.id} error:`, error)
                success = false
            }

            results.processed++

            if (success) {
                // Mark as completed
                await supabase
                    .from('webhook_jobs')
                    .update({
                        status: 'completed',
                        completed_at: new Date().toISOString(),
                    })
                    .eq('id', job.id)
                results.succeeded++
            } else {
                const newRetryCount = job.retry_count + 1

                if (newRetryCount >= job.max_retries) {
                    // Mark as dead - too many retries
                    await supabase
                        .from('webhook_jobs')
                        .update({
                            status: 'dead',
                            retry_count: newRetryCount,
                            error_message: 'Max retries exceeded',
                        })
                        .eq('id', job.id)

                    // Notify admins
                    await supabase.from('feature_notifications').insert({
                        type: 'pipeline_failure',
                        category: 'alert',
                        message: `Webhook job failed permanently: ${job.job_type} (${job.id})`,
                        target_role: 'admin',
                        is_read: false,
                    })

                    results.dead++
                } else {
                    // Calculate next retry with exponential backoff
                    const backoffMinutes = [1, 5, 15][newRetryCount - 1] || 15
                    const nextRetry = new Date(Date.now() + backoffMinutes * 60 * 1000)

                    await supabase
                        .from('webhook_jobs')
                        .update({
                            status: 'pending',
                            retry_count: newRetryCount,
                            next_retry_at: nextRetry.toISOString(),
                        })
                        .eq('id', job.id)

                    results.failed++
                }
            }
        }

        console.log('[Webhook Retry] Completed:', results)

        return NextResponse.json(results)
    } catch (error) {
        console.error('[Webhook Retry] Cron error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

/**
 * Process a single webhook job
 */
async function processJob(job: WebhookJob): Promise<boolean> {
    switch (job.job_type) {
        case 'slack_channel': {
            if (job.payload.type === 'celebration' && job.payload.context) {
                const message = buildSaleCelebration(job.payload.context)
                const result = await postToSalesChannel(message)
                return result.success
            }
            return false
        }

        case 'slack_dm': {
            if (job.payload.slackUserId && job.payload.message) {
                const result = await sendDirectMessage(
                    job.payload.slackUserId,
                    job.payload.message as { text: string; blocks?: unknown[] }
                )
                return result.success
            }
            return false
        }

        default:
            console.warn(`[Webhook Retry] Unknown job type: ${job.job_type}`)
            return false
    }
}
