import { processScheduledCharges } from '@/lib/actions/cron-actions'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic' // Ensure it runs every time

export async function GET(request: Request) {
    // Optional: Add Authentication check here
    // const authHeader = request.headers.get('authorization')
    // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    //     return new Response('Unauthorized', { status: 401 })
    // }

    try {
        const result = await processScheduledCharges()
        return NextResponse.json(result)
    } catch (error) {
        console.error('Cron job error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
