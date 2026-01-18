import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
    try {
        const supabase = await createClient()
        const { meeting_url } = await req.json()

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

        // 1. Create the detailed record immediately
        const { data: record, error: insertError } = await supabase
            .from('sales_call_logs')
            .insert({
                meeting_url,
                status: 'transcribing',
                submitted_by: 'Austin Farwell', // Ideally from auth user context
                client_name: 'Analyzing Call...', // Placeholder until analysis
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

        // 2. Forward to n8n Webhook with the new record ID
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
