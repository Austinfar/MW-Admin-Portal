import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getCurrentUserAccess } from '@/lib/auth-utils'
import { startOfDay, endOfDay } from 'date-fns'

export async function POST(req: Request) {
    try {
        const supabase = await createClient()
        const { meeting_url } = await req.json()

        // 1. Authenticate User
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const userAccess = await getCurrentUserAccess()
        const userName = userAccess ? `${userAccess.first_name || ''} ${userAccess.last_name || ''}`.trim() || user.email : 'Unknown User'
        const userRole = userAccess?.role || 'user'

        // 2. Check Credit Limits
        let limit = 2
        if (userRole === 'super_admin') limit = Infinity
        else if (userRole === 'admin') limit = 10

        if (limit !== Infinity) {
            const todayStart = startOfDay(new Date()).toISOString()
            const todayEnd = endOfDay(new Date()).toISOString()

            const { count, error: countError } = await supabase
                .from('sales_call_logs')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id)
                .gte('created_at', todayStart)
                .lte('created_at', todayEnd)

            if (countError) {
                console.error('Limit check error:', countError)
                return NextResponse.json({ error: 'Failed to verify limits' }, { status: 500 })
            }

            if ((count || 0) >= limit) {
                return NextResponse.json(
                    { error: `Daily limit reached (${count}/${limit}). Please contact support or upgrade.` },
                    { status: 403 }
                )
            }
        }

        if (!meeting_url) {
            return NextResponse.json(
                { error: 'Meeting URL is required' },
                { status: 400 }
            )
        }

        // Validate URL domain
        try {
            const url = new URL(meeting_url)
            if (!url.hostname.endsWith('fireflies.ai')) {
                return NextResponse.json(
                    { error: 'Invalid URL. Only Fireflies.ai recording URLs are currently supported.' },
                    { status: 400 }
                )
            }
        } catch (e) {
            return NextResponse.json(
                { error: 'Invalid URL format' },
                { status: 400 }
            )
        }

        // 3. Create the detailed record immediately
        const { data: record, error: insertError } = await supabase
            .from('sales_call_logs')
            .insert({
                meeting_url,
                status: 'transcribing',
                submitted_by: userName,
                client_name: 'Analyzing Call...',
                user_id: user.id
            })
            .select()
            .single()

        if (insertError) {
            console.error('Database insertion error:', insertError)
            return NextResponse.json(
                { error: 'Failed to create analysis record' },
                { status: 500 }
            )
        }

        const webhookUrl = process.env.N8N_SALES_ANALYZER_WEBHOOK

        if (!webhookUrl) {
            return NextResponse.json(
                { error: 'System configuration error: Webhook URL not set' },
                { status: 500 }
            )
        }

        // 4. Forward to n8n Webhook with the new record ID
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                query: meeting_url,
                record_id: record.id,
                callback_url: `${new URL(req.url).origin}/api/webhooks/sales/update-status`
            }),
        })

        if (!response.ok) {
            // Optional: fallback to updating status to 'failed' if webhook fails
            await supabase
                .from('sales_call_logs')
                .update({ status: 'failed' })
                .eq('id', record.id)

            throw new Error(`n8n webhook failed with status: ${response.status}`)
        }

        return NextResponse.json({ success: true, message: 'Analysis queued', id: record.id })
    } catch (error) {
        console.error('Error triggering analysis:', error)
        return NextResponse.json(
            { error: 'Failed to start analysis' },
            { status: 500 }
        )
    }
}
