'use server';

import { GHLClient } from '@/lib/ghl/client';
import { syncGHLContact } from '@/lib/ghl/sync';
import { getAppSettings, updateAppSetting } from '@/lib/actions/app-settings';
import { revalidatePath, revalidateTag } from 'next/cache';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { createAdminClient } from '@/lib/supabase/admin';

// Cache file for pipelines (5 min TTL)
const PIPELINES_CACHE_FILE = join(process.cwd(), '.pipelines-cache.json');
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Helper to get client with DB settings
async function getAuthenticatedGHLClient() {
    const settings = await getAppSettings();
    const token = settings['ghl_access_token'];
    const refreshToken = settings['ghl_refresh_token'];
    const location = settings['ghl_location_id'];

    console.log('[GHL Info] Using credentials from DB:', { tokenExists: !!token, location });

    return new GHLClient(token, location, {
        refreshToken,
        onTokenRefresh: async (newTokens) => {
            console.log('[GHL Action] Refreshing stored tokens via callback');
            await updateAppSetting('ghl_access_token', newTokens.access_token);
            await updateAppSetting('ghl_refresh_token', newTokens.refresh_token);
            if (newTokens.expires_in) {
                const expiresAt = new Date(Date.now() + newTokens.expires_in * 1000).toISOString();
                await updateAppSetting('ghl_token_expires_at', expiresAt);
            }
        }
    });
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



    // Use the new getAllContacts method which handles pagination properly
    // Note: This relies on the GHL API supporting pipelineId filter on /contacts/
    const result = await client.getAllContacts(undefined, pipelineId);

    if (!result || !result.contacts) {
        console.error('[GHL Error] Failed to fetch contacts for pipeline:', pipelineId, result);
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
        return { error: 'Failed to fetch contacts', count: 0 };
    }

    const contacts = result.contacts;

    // Deduplicate by ID just in case
    const uniqueContacts = new Map();
    for (const contact of contacts) {
        if (contact.id && !uniqueContacts.has(contact.id)) {
            uniqueContacts.set(contact.id, contact);
        }
    }

    const uniqueContactList = Array.from(uniqueContacts.values());
    const total = uniqueContactList.length;

    console.log(`Starting sync for Pipeline ${pipelineId}. Found ${contacts.length} total fetched, ${total} unique contacts.`);

    // Fetch custom field definitions once for enrichment
    let customFieldDefinitions: any[] = [];
    try {
        const cfRes = await client.getCustomFields();
        customFieldDefinitions = cfRes?.customFields || [];
        console.log(`[GHL Info] Fetched ${customFieldDefinitions.length} custom field definitions for sync enrichment.`);
    } catch (e) {
        console.warn('[GHL Warning] Failed to fetch custom definitions for sync, fields will not be enriched.', e);
    }

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

    // Log the first contact to see the structure
    if (uniqueContactList.length > 0) {
        console.log('[DEBUG] First Contact Structure:', JSON.stringify(uniqueContactList[0], null, 2));
    }

    // Small delay helper to avoid rate limiting
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // Loop through unique contacts
    for (const [index, contact] of uniqueContactList.entries()) {
        const contactId = contact.id;

        if (contactId) {
            // We pass the Full Contact Object if available to save a fetch?
            // Actually syncGHLContact logic (in sync.ts) might re-fetch to ensure full fields.
            // Let's passed ID as expected by current signature.
            const syncResult = await syncGHLContact(contactId, client, customFieldDefinitions);
            if (syncResult.error) {
                console.error(`Failed to sync contact ${contactId}:`, syncResult.error);
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

        // Small delay between requests to avoid rate limiting (50ms)
        await delay(50);
    }

    const debugData = uniqueContactList.length > 0 ? uniqueContactList[0] : null;

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

export async function syncCallBookedLeads() {
    const TARGET_PIPELINE_ID = 'b8b4YK6vrZzlMgET6f5w';
    const TARGET_STAGE_ID = '50fe0592-c82e-46c9-9312-7fdf906c8ecb';

    console.log('[GHL Sync] Starting Call Booked sync...');
    const client = await getAuthenticatedGHLClient();

    // 1. Fetch opportunities for the pipeline
    console.log(`[GHL Sync] Fetching opportunities for pipeline: ${TARGET_PIPELINE_ID}`);
    const { opportunities } = await client.getOpportunities(TARGET_PIPELINE_ID);

    if (!opportunities) {
        console.error('[GHL Sync] Failed to fetch opportunities');
        return { error: 'Failed to fetch opportunities' };
    }

    // 2. Filter for specific stage
    const callBookedOps = opportunities.filter((op: any) => op.pipelineStageId === TARGET_STAGE_ID);
    console.log(`[GHL Sync] Found ${opportunities.length} total ops, ${callBookedOps.length} in 'Call Booked' stage.`);

    if (callBookedOps.length === 0) {
        return { success: true, count: 0, message: 'No contacts found in Call Booked stage' };
    }

    const supabase = createAdminClient();
    let syncedCount = 0;
    let errors = 0;

    for (const op of callBookedOps) {
        try {
            if (!op.contact) continue;

            const contact = op.contact;
            // Map data
            const leadData = {
                first_name: contact.firstName || op.name?.split(' ')[0] || 'Unknown',
                last_name: contact.lastName || op.name?.split(' ').slice(1).join(' ') || '',
                email: contact.email,
                phone: contact.phone,
                description: `Imported from GHL 'Call Booked' stage (Op ID: ${op.id})`,
                status: 'Appt Set', // Maps to "Call Booked" intent
                source: 'GHL',
                updated_at: new Date().toISOString()
            };

            // Upsert based on email
            if (leadData.email) {
                const { data: existing } = await supabase
                    .from('leads')
                    .select('id')
                    .eq('email', leadData.email)
                    .single();

                if (existing) {
                    // Update
                    await supabase
                        .from('leads')
                        .update(leadData)
                        .eq('id', existing.id);
                    syncedCount++;
                } else {
                    // Insert
                    await supabase
                        .from('leads')
                        .insert(leadData);
                    syncedCount++;
                }
            } else {
                // Insert if no email but has name/phone? 
                // Assuming we want to capture them.
                await supabase.from('leads').insert(leadData);
                syncedCount++;
            }

        } catch (e) {
            console.error('[GHL Sync] Error processing op:', op.id, e);
            errors++;
        }
    }

    console.log(`[GHL Sync] Completed. Synced: ${syncedCount}, Errors: ${errors}`);
    return { success: true, count: syncedCount, errors };
}

