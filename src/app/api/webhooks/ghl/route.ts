import { NextRequest, NextResponse } from 'next/server'
import { syncGHLContact } from '@/lib/ghl/sync'

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        // GHL Webhook payload structure varies, but usually contains type and contact info
        // Example: { type: 'ContactCreated', ... }

        console.log('Received GHL Webhook:', body.type)

        if (body.type === 'ContactCreate' || body.type === 'ContactUpdate') {
            // Some payloads send full contact data, others just ID. 
            // Adjust based on actual payload. Assuming standard GHL webhook.
            // If body has 'id', treated as contact ID? No, body usually has keys like 'contact_id' or nested object.
            // For safety, we can just fetch fresh data if ID provided, or use provided data.
            // Let's assume body has the data we need or ID. 

            const contactId = body.id || body.contact_id
            if (contactId) {
                await syncGHLContact(contactId)
            }
        }

        return NextResponse.json({ received: true })
    } catch (error) {
        console.error('Webhook Error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
