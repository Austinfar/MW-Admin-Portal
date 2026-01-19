import { NextRequest, NextResponse } from 'next/server'
import { syncGHLContact } from '@/lib/ghl/sync'
import * as fs from 'fs'
import * as path from 'path'

// TODO: Replace with the actual Stage ID from your GHL Pipeline Settings
const LEAD_STAGE_ID = process.env.GHL_LEAD_STAGE_ID || 'REPLACE_WITH_YOUR_STAGE_ID'

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        // GHL Webhook payload structure varies, but usually contains type and contact info
        // Example: { type: 'ContactCreated', ... }

        const logEntry = `\n[${new Date().toISOString()}] Received GHL Webhook:\n${JSON.stringify(body, null, 2)}\n`
        console.log(logEntry)

        try {
            const logPath = path.join(process.cwd(), 'webhook_debug.log')
            fs.appendFileSync(logPath, logEntry)
        } catch (err) {
            console.error('Failed to write to debug log:', err)
        }

        if (body.type === 'ContactCreate' || body.type === 'ContactUpdate') {
            // Some payloads send full contact data, others just ID. 
            // Adjust based on actual payload. Assuming standard GHL webhook.
            // If body has 'id', treated as contact ID? No, body usually has keys like 'contact_id' or nested object.
            // For safety, we can just fetch fresh data if ID provided, or use provided data.
            // Let's assume body has the data we need or ID. 

            // Let's assume body has the data we need or ID. 
            const contactId = body.id || body.contact_id
            if (contactId) {
                await syncGHLContact(contactId)
            }
        }

        // Handle Pipeline Stage Changes for Leads
        if (body.type === 'OpportunityStatusUpdate') {
            console.log('[GHL Webhook] Opportunity Update:', {
                pipelineId: body.pipelineId,
                stageId: body.stageId,
                contactId: body.contact_id || body.contact?.id,
                pipelineName: body.pipelineName,
                stageName: body.stageName
            })

            // Target: "Call Booked" in "0. Lead Pipeline"
            // We check both Name (if available) and ID (if configured)
            const targetStageName = 'call booked'
            const targetPipelineName = '0. lead pipeline'

            const currentStageName = (body.stageName || '').toLowerCase()
            const currentPipelineName = (body.pipelineName || '').toLowerCase()

            const matchByName = currentStageName.includes(targetStageName) &&
                (currentPipelineName.includes(targetPipelineName) || !body.pipelineName) // Permissive if pipeline name missing

            const matchById = body.stageId === LEAD_STAGE_ID

            if (matchByName || matchById) {
                console.log(`[GHL Webhook] Target Lead Stage Detected: ${body.stageName} (${body.stageId}). Syncing...`)
                const contactId = body.contact_id || body.contact?.id
                if (contactId) {
                    const { syncGHLLead } = await import('@/lib/ghl/sync')
                    await syncGHLLead(contactId)
                }
            } else {
                console.log(`[GHL Webhook] Stage '${body.stageName}' does not match target. Ignoring.`)
            }
        }

        return NextResponse.json({ received: true })
    } catch (error) {
        console.error('Webhook Error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
