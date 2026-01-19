
import { NextRequest, NextResponse } from 'next/server';
import { updateGHLContact } from '@/lib/actions/ghl';

// Verify webhook (optional, GHL doesn't sign requests consistently like Stripe)
// Usually you'd check the Location ID matches what you expect

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { type, locationId, data } = body;

        console.log(`[GHL Webhook] Received ${type} for location ${locationId}`);

        // TODO: Validate Location ID matches our connected account?
        // const settings = await getAppSettings();
        // if (settings.ghl_location_id !== locationId) { ... }

        switch (type) {
            case 'ContactCreate':
            case 'ContactUpdate':
                // Handle Contact Sync (GHL -> Dashboard)
                // This would typically update the 'users' or 'clients' table
                console.log('[GHL Webhook] Contact Update:', data);
                // await syncContactToDashboard(data);
                break;

            case 'OpportunityStatusUpdate':
            case 'OpportunityCreate':
            case 'OpportunityUpdate':
                console.log('[GHL Webhook] Opportunity Update:', data);
                // await syncOpportunityToDashboard(data);
                break;

            case 'InboundMessage':
                console.log('[GHL Webhook] Inbound Message:', data);
                break;

            default:
                console.log('[GHL Webhook] Unhandled event type:', type);
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error('[GHL Webhook] Error processing request:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
