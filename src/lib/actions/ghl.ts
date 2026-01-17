'use server';

import { GHLClient } from '@/lib/ghl/client';
import { syncGHLContact } from '@/lib/ghl/sync';
import { getAppSettings } from '@/lib/actions/app-settings';
import { revalidatePath, revalidateTag } from 'next/cache';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

// Cache file for pipelines (5 min TTL)
const PIPELINES_CACHE_FILE = join(process.cwd(), '.pipelines-cache.json');
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Helper to get client with DB settings
async function getAuthenticatedGHLClient() {
    const settings = await getAppSettings();
    const token = settings['ghl_access_token'];
    const location = settings['ghl_location_id'];
    console.log('[GHL Info] Using credentials from DB:', { tokenExists: !!token, location });
    return new GHLClient(token, location);
}

/**
 * Fetches all pipelines from GHL location with caching to avoid rate limits.
 */
export async function getGHLPipelines() {
    // Try to read from cache first
    try {
        if (existsSync(PIPELINES_CACHE_FILE)) {
            const cached = JSON.parse(readFileSync(PIPELINES_CACHE_FILE, 'utf-8'));
            const age = Date.now() - cached.timestamp;
            if (age < CACHE_TTL_MS && cached.pipelines?.length > 0) {
                console.log('[GHL Info] Using cached pipelines (age: ' + Math.round(age / 1000) + 's)');
                return { pipelines: cached.pipelines };
            }
        }
    } catch (e) {
        // Cache read failed, continue to API call
    }

    const client = await getAuthenticatedGHLClient();
    const result = await client.getPipelines();

    if (!result || !result.pipelines) {
        // On rate limit or error, try to return stale cache
        try {
            if (existsSync(PIPELINES_CACHE_FILE)) {
                const cached = JSON.parse(readFileSync(PIPELINES_CACHE_FILE, 'utf-8'));
                if (cached.pipelines?.length > 0) {
                    console.log('[GHL Info] API failed, returning stale cache');
                    return { pipelines: cached.pipelines, stale: true };
                }
            }
        } catch (e) { }
        return { error: 'Failed to fetch pipelines', pipelines: [] };
    }

    // Cache the successful result
    try {
        writeFileSync(PIPELINES_CACHE_FILE, JSON.stringify({
            pipelines: result.pipelines,
            timestamp: Date.now()
        }), 'utf-8');
    } catch (e) {
        console.error('[GHL Cache] Failed to write cache:', e);
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
        synced: 0,
        matched_stripe: 0,
        unmatched_stripe: 0,
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
            synced: 0,
            matched_stripe: 0,
            unmatched_stripe: 0,
            errors: 1,
            last_updated: new Date().toISOString()
        });
        return { error: 'Failed to fetch opportunities', count: 0 };
    }

    const opportunities = result.opportunities;

    // Deduplicate by Contact ID to avoid redundant syncs
    const uniqueContacts = new Map();
    for (const opp of opportunities) {
        const contactId = typeof opp.contact === 'string'
            ? opp.contact
            : (opp.contact?.id || opp.contactId || opp.contact_id);

        if (contactId && !uniqueContacts.has(contactId)) {
            uniqueContacts.set(contactId, opp);
        }
    }

    const uniqueOpps = Array.from(uniqueContacts.values());
    const total = uniqueOpps.length;

    console.log(`Starting sync for Pipeline ${pipelineId}. Found ${opportunities.length} opportunities, ${total} unique contacts.`);

    if (total === 0) {
        return { success: true, count: 0, errors: 0 };
    }

    let syncedCount = 0;
    let errorCount = 0;
    let matchedCount = 0;
    let unmatchedCount = 0;

    // Initialize Sync Status with Total
    await updateSyncStatus({
        state: 'syncing',
        total: total,
        processed: 0,
        synced: 0,
        matched_stripe: 0,
        unmatched_stripe: 0,
        errors: 0,
        last_updated: new Date().toISOString()
    });

    // Log the first opportunity to see the structure
    if (opportunities.length > 0) {
        console.log('[DEBUG] First Opportunity Structure:', JSON.stringify(opportunities[0], null, 2));
    }

    // Small delay helper to avoid rate limiting
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // Loop through unique contacts
    for (const [index, opp] of uniqueOpps.entries()) {
        const contactToSync = opp.contact || opp.contactId || opp.contact_id;
        const contactIdForLog = typeof contactToSync === 'string' ? contactToSync : (contactToSync?.id || 'unknown');

        if (contactToSync) {
            const syncResult = await syncGHLContact(contactToSync, client);
            if (syncResult.error) {
                console.error(`Failed to sync contact ${contactIdForLog}:`, syncResult.error);
                errorCount++;
            } else {
                syncedCount++;
                if (syncResult.stripeLinked) {
                    matchedCount++;
                } else {
                    unmatchedCount++;
                }
            }
        }

        // Update status after every contact for real-time progress updates
        await updateSyncStatus({
            state: 'syncing',
            total: total,
            processed: index + 1,
            synced: syncedCount,
            matched_stripe: matchedCount,
            unmatched_stripe: unmatchedCount,
            errors: errorCount,
            last_updated: new Date().toISOString()
        });

        // Small delay between requests to avoid rate limiting (100ms)
        await delay(50);
    }

    const debugData = opportunities.length > 0 ? opportunities[0] : null;

    // Final Success Status
    await updateSyncStatus({
        state: 'completed',
        total: total,
        processed: total,
        synced: syncedCount,
        matched_stripe: matchedCount,
        unmatched_stripe: unmatchedCount,
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

export async function sendGHLSms(contactId: string, message: string) {
    const client = await getAuthenticatedGHLClient();
    if (!contactId || !message) return { error: 'Missing contact ID or message' };

    try {
        const result = await client.sendSMS(contactId, message);
        if (!result) {
            return { error: 'Failed to send SMS via GHL' };
        }
        return { success: true };
    } catch (error) {
        console.error('Error sending GHL SMS:', error);
        return { error: 'Internal server error during SMS send' };
    }
}
