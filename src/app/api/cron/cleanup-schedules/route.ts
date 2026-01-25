import { cleanupAbandonedSchedules } from '@/lib/actions/cron-actions'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Cron job to cleanup abandoned payment schedules
 * Schedules with 'pending_initial' status older than 7 days are marked as 'expired'
 *
 * Recommended schedule: Daily at 3 AM
 * Vercel Cron: 0 3 * * *
 */
export async function GET(request: Request) {
    // Optional: Add cron secret verification for production
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        console.warn('[Cleanup Cron] Unauthorized request')
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        console.log('[Cleanup Cron] Starting abandoned schedule cleanup...')
        const result = await cleanupAbandonedSchedules()
        console.log('[Cleanup Cron] Completed:', result)
        return NextResponse.json(result)
    } catch (error) {
        console.error('[Cleanup Cron] Error:', error)
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        )
    }
}
