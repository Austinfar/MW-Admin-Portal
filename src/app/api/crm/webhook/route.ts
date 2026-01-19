
import { NextRequest, NextResponse } from 'next/server';
import { updateGHLContact } from '@/lib/actions/ghl';

// Verify webhook (optional, GHL doesn't sign requests consistently like Stripe)
// Usually you'd check the Location ID matches what you expect

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { type, locationId, data } = body;

        console.log(`[GHL Webhook] Received ${type}`);

        // Get configured settings
        const { getAppSettings } = await import('@/lib/actions/app-settings');
        const settings = await getAppSettings();
        const monitoredPipelineId = settings['ghl_sync_pipeline_id'];

        if (!monitoredPipelineId) {
            console.log('[GHL Webhook] No pipeline configured for sync. Skipping.');
            return NextResponse.json({ received: true, status: 'skipped_no_config' });
        }

        switch (type) {
            case 'OpportunityStatusUpdate':
            case 'OpportunityCreate':
            case 'OpportunityUpdate':
                // Check if this opportunity belongs to the monitored pipeline
                // GHL payload usually has 'pipelineId' in data
                if (data.pipelineId === monitoredPipelineId) {
                    console.log(`[GHL Webhook] Opportunity matched pipeline ${monitoredPipelineId}. Syncing contact...`);

                    const { syncGHLContact } = await import('@/lib/ghl/sync');

                    // data usually contains contactId or contact_id
                    const contactId = data.contactId || data.contact_id;

                    if (contactId) {
                        const result = await syncGHLContact(contactId);
                        if (result.success) {
                            console.log(`[GHL Webhook] Successfully synced contact ${contactId}`);
                        } else {
                            console.error(`[GHL Webhook] Failed to sync contact ${contactId}:`, result.error);
                        }
                    } else {
                        console.warn('[GHL Webhook] No contact ID found in opportunity data', data);
                    }
                } else {
                    console.log(`[GHL Webhook] Ignoring opportunity from pipeline ${data.pipelineId} (Monitored: ${monitoredPipelineId})`);
                }
                break;

            case 'ContactDelete':
                // Optional: Handle deletions if needed
                break;

            case 'ContactCreate':
            case 'ContactUpdate':
                console.log(`[GHL Webhook] Contact event ${type} received. Syncing...`);
                const { syncGHLContact: syncContact } = await import('@/lib/ghl/sync');
                // GHL payload for contact events usually has 'id' at the top level or inside 'data'
                // Based on standard GHL V2 webhooks
                const possibleId = body.id || body.contact_id || (data && (data.id || data.contact_id));

                if (possibleId) {
                    const result = await syncContact(possibleId);
                    if (result.success) {
                        console.log(`[GHL Webhook] Successfully synced contact ${possibleId}`);
                    } else {
                        console.error(`[GHL Webhook] Failed to sync contact ${possibleId}:`, result.error);
                    }
                } else {
                    console.warn('[GHL Webhook] No contact ID found in updated event', body);
                }
                break;

            default:
                // We mainly care about opportunities moving in the specific pipeline
                // But could also listen to contact updates if we wanted to be very aggressive
                break;
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error('[GHL Webhook] Error processing request:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
