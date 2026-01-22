import { processWeeklyCheckins } from '@/lib/actions/cron-actions'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        const result = await processWeeklyCheckins()
        return NextResponse.json(result)
    } catch (error) {
        console.error('[SMS Check-in Cron] Error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
