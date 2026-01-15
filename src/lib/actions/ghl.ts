'use server';

import { GHLClient } from '@/lib/ghl/client';
import { syncGHLContact } from '@/lib/ghl/sync';
import { getAppSettings } from '@/lib/actions/app-settings';
import { revalidatePath, revalidateTag } from 'next/cache';

// Helper to get client with DB settings
async function getAuthenticatedGHLClient() {
    const settings = await getAppSettings();
    const token = settings['ghl_access_token'];
    const location = settings['ghl_location_id'];
    console.log('[GHL Info] Using credentials from DB:', { tokenExists: !!token, location });
    return new GHLClient(token, location);
}

/**
 * Fetches all pipelines from GHL location.
 */
export async function getGHLPipelines() {
    const client = await getAuthenticatedGHLClient();
    const result = await client.getPipelines();

    if (!result || !result.pipelines) {
        return { error: 'Failed to fetch pipelines', pipelines: [] };
    }

    return { pipelines: result.pipelines };
}

/**
 * Trigger sync for all contacts in a specific pipeline.
 * Iterates through opportunities in that pipeline and syncs each associated contact.
 */
import { updateSyncStatus } from '@/lib/actions/app-settings';

// ... imports

export async function syncGHLPipeline(pipelineId: string) {
    const client = await getAuthenticatedGHLClient();

    // Reset status to syncing
    await updateSyncStatus({
        state: 'syncing',
        total: 0,
        processed: 0,
        errors: 0,
        last_updated: new Date().toISOString()
    });

    const result = await client.getOpportunities(pipelineId);

    if (!result || !result.opportunities) {
        console.error('[GHL Error] Failed to fetch opportunities for pipeline:', pipelineId, result);
        await updateSyncStatus({
            state: 'error',
            total: 0,
            processed: 0,
            errors: 1,
            last_updated: new Date().toISOString()
        });
        return { error: 'Failed to fetch opportunities', count: 0 };
    }

    const opportunities = result.opportunities;
    let syncedCount = 0;
    let errorCount = 0;
    const total = opportunities.length;

    console.log(`Starting sync for Pipeline ${pipelineId}. Found ${total} opportunities.`);

    // Initialize Sync Status with Total
    await updateSyncStatus({
        state: 'syncing',
        total: total,
        processed: 0,
        errors: 0,
        last_updated: new Date().toISOString()
    });

    // Log the first opportunity to see the structure
    if (opportunities.length > 0) {
        console.log('[DEBUG] First Opportunity Structure:', JSON.stringify(opportunities[0], null, 2));
    }

    // Loop
    for (const [index, opp] of opportunities.entries()) {
        const contactToSync = opp.contact || opp.contactId || opp.contact_id;
        const contactIdForLog = typeof contactToSync === 'string' ? contactToSync : (contactToSync?.id || 'unknown');

        if (contactToSync) {
            const syncResult = await syncGHLContact(contactToSync, client);
            if (syncResult.error) {
                console.error(`Failed to sync contact ${contactIdForLog}:`, syncResult.error);
                errorCount++;
            } else {
                syncedCount++;
            }
        } else {
            // Even if we skip, we count it as processed in terms of "items handled"
        }

        // Update status every 5 items or last item
        if ((index + 1) % 5 === 0 || index === total - 1) {
            await updateSyncStatus({
                state: 'syncing',
                total: total,
                processed: index + 1,
                errors: errorCount,
                last_updated: new Date().toISOString()
            });
        }
    }

    const debugData = opportunities.length > 0 ? opportunities[0] : null;

    // Final Success Status
    await updateSyncStatus({
        state: 'completed',
        total: total,
        processed: total,
        errors: errorCount,
        last_updated: new Date().toISOString()
    });

    // Refresh the clients list page so the new data appears immediately
    revalidatePath('/clients');
    // revalidateTag('clients');

    return { success: true, count: syncedCount, errors: errorCount, debugData };
}

export async function updateGHLContact(contactId: string, data: any) {
    const client = await getAuthenticatedGHLClient();
    if (!contactId) return { error: 'No Contact ID provided' };

    try {
        const result = await client.updateContact(contactId, data);
        if (!result || !result.contact) {
            return { error: 'Failed to update GHL contact' };
        }
        return { success: true, contact: result.contact };
    } catch (error) {
        console.error('Error updating GHL contact:', error);
        return { error: 'Internal server error during GHL update' };
    }
}
