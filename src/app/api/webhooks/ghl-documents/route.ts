import { NextRequest, NextResponse } from 'next/server'
import { updateAgreementFromWebhook } from '@/lib/actions/agreements'
import crypto from 'crypto'

const GHL_DOCUMENT_WEBHOOK_SECRET = process.env.GHL_DOCUMENT_WEBHOOK_SECRET || ''

/**
 * Verify GHL webhook signature if secret is configured
 */
function verifySignature(body: string, signature: string | null): boolean {
    if (!GHL_DOCUMENT_WEBHOOK_SECRET) {
        // No secret configured, skip verification (not recommended for production)
        console.warn('[GHL Documents] No webhook secret configured - skipping signature verification')
        return true
    }

    if (!signature) {
        console.error('[GHL Documents] No signature provided')
        return false
    }

    const expectedSignature = crypto
        .createHmac('sha256', GHL_DOCUMENT_WEBHOOK_SECRET)
        .update(body)
        .digest('hex')

    return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
    )
}

/**
 * GHL Document Webhook Handler
 *
 * Receives document status updates from GHL:
 * - document.viewed - Client viewed the document
 * - document.signed - Client signed the document
 * - document.expired - Document expired without signature
 */
export async function POST(req: NextRequest) {
    try {
        const rawBody = await req.text()
        const signature = req.headers.get('x-ghl-signature') ||
            req.headers.get('x-signature') ||
            req.headers.get('signature')

        // Verify signature
        if (!verifySignature(rawBody, signature)) {
            console.error('[GHL Documents] Invalid signature')
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
        }

        const body = JSON.parse(rawBody)

        console.log('[GHL Documents] Webhook received:', {
            type: body.type,
            documentId: body.documentId || body.document?.id,
            status: body.status || body.document?.status,
        })

        // Extract document info - GHL may structure this differently
        const documentId = body.documentId ||
            body.document?.id ||
            body.data?.documentId ||
            body.data?.document?.id ||
            body.id // Check usage of top-level ID

        // If no document ID but we have a Contact ID, we proceed (Blind Sign)
        // logic later will attempt to match via Contact ID
        if (!documentId) {
            // Check if we can proceed with just Contact ID
            const hasContactId = body.contactId || body.contact_id || body.document?.contactId || body.document?.contact?.id || body.data?.contactId

            if (!hasContactId) {
                console.error('[GHL Documents] No document ID or Contact ID in webhook payload')
                return NextResponse.json({
                    error: 'Missing document ID',
                    keys: Object.keys(body),
                    dataKeys: body.data ? Object.keys(body.data) : []
                }, { status: 400 })
            }

            console.warn('[GHL Documents] No Document ID found, but proceeding with Contact ID lookup')
        }

        // Determine the status from webhook event type
        const eventType = body.type || body.event || body.eventType || ''
        let status: 'viewed' | 'signed' | 'expired' | 'voided' | null = null
        let signedDocumentUrl: string | undefined

        // Map GHL event types to our status
        // Note: These are example event types - adjust based on actual GHL webhook format
        if (eventType.toLowerCase().includes('viewed') ||
            eventType.toLowerCase().includes('opened')) {
            status = 'viewed'
        } else if (eventType.toLowerCase().includes('signed') ||
            eventType.toLowerCase().includes('completed')) {
            status = 'signed'
            signedDocumentUrl = body.signedDocumentUrl ||
                body.document?.signedDocumentUrl ||
                body.data?.signedDocumentUrl
        } else if (eventType.toLowerCase().includes('expired') ||
            eventType.toLowerCase().includes('voided')) {
            status = 'expired'
        } else if (eventType.toLowerCase().includes('declined')) {
            status = 'voided'
        }

        // Also check status field directly if event type didn't match
        if (!status) {
            const docStatus = (body.status || body.document?.status || '').toLowerCase()
            if (docStatus === 'viewed' || docStatus === 'opened') {
                status = 'viewed'
            } else if (docStatus === 'signed' || docStatus === 'completed') {
                status = 'signed'
                signedDocumentUrl = body.signedDocumentUrl ||
                    body.document?.signedDocumentUrl
            } else if (docStatus === 'expired' || docStatus === 'voided') {
                status = 'expired'
            } else if (docStatus === 'declined') {
                status = 'voided'
            }
        }

        if (!status) {
            // Check customData just in case
            const customDataStatus = (body.customData?.status || '').toLowerCase()
            if (customDataStatus) {
                if (customDataStatus === 'viewed' || customDataStatus === 'opened') status = 'viewed'
                else if (customDataStatus === 'signed' || customDataStatus === 'completed') status = 'signed'
                else if (customDataStatus === 'expired' || customDataStatus === 'voided' || customDataStatus === 'declined') status = 'voided'

                if (status && customDataStatus === 'signed') {
                    signedDocumentUrl = body.customData?.signedDocumentUrl
                }
            }
        }

        if (!status) {
            console.log('[GHL Documents] Unhandled event type:', eventType, body.status)
            return NextResponse.json({
                received: true,
                handled: false,
                message: 'Status could not be determined from payload',
                keys: Object.keys(body),
                customData: body.customData ? Object.keys(body.customData) : 'missing'
            })
        }

        // Extract contact ID
        const contactId = body.contactId ||
            body.contact_id ||
            body.document?.contactId ||
            body.document?.contact?.id ||
            body.data?.contactId

        // Update agreement in database
        const result = await updateAgreementFromWebhook(documentId, status, signedDocumentUrl, contactId)

        if (!result.success) {
            console.error('[GHL Documents] Failed to update agreement:', result.error)
            // Return 200 to prevent retries for data issues
            return NextResponse.json({
                received: true,
                handled: false,
                error: result.error
            })
        }

        console.log('[GHL Documents] Agreement updated:', { documentId, status })

        return NextResponse.json({ received: true, handled: true })
    } catch (error) {
        console.error('[GHL Documents] Webhook error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

/**
 * Handle GHL webhook verification (GET request)
 * Some webhook systems require a verification endpoint
 */
export async function GET(req: NextRequest) {
    const challenge = req.nextUrl.searchParams.get('challenge') ||
        req.nextUrl.searchParams.get('hub.challenge')

    if (challenge) {
        return new NextResponse(challenge, {
            status: 200,
            headers: { 'Content-Type': 'text/plain' }
        })
    }

    return NextResponse.json({ status: 'GHL Documents Webhook Active' })
}
