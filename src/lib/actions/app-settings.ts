'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath, unstable_noStore } from 'next/cache';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

export type SyncStatus = {
    state: 'idle' | 'syncing' | 'completed' | 'error';
    total: number;
    processed: number;
    synced: number;  // Actually successfully synced contacts
    matched_stripe: number; // Contacts linked to a Stripe Customer
    unmatched_stripe: number; // Contacts processed but no Stripe Match found
    errors: number;
    last_updated: string;
};

// Use a temp file to persist state across server action invocations
const SYNC_STATUS_FILE = join(process.cwd(), '.sync-status.json');

export async function getAppSettings() {
    unstable_noStore(); // Force dynamic fetch
    const supabase = createAdminClient();

    // Fetch all settings
    const { data, error } = await supabase
        .from('app_settings')
        .select('*');

    if (error) {
        console.error('Error fetching settings:', {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint
        });
        return {};
    }

    // Convert to object for easier consumption { key: value }
    const settingsMap: Record<string, string> = {};
    data?.forEach(setting => {
        settingsMap[setting.key] = setting.value;
    });

    return settingsMap;
}

export async function updateAppSetting(key: string, value: string) {
    const supabase = createAdminClient();

    const { error } = await supabase
        .from('app_settings')
        .upsert({
            key,
            value,
            updated_at: new Date().toISOString()
        });

    if (error) {
        console.error('Error updating setting:', error);
        return { error: 'Failed to update setting' };
    }

    revalidatePath('/settings');
    return { success: true };
}

export async function getSyncStatus(): Promise<SyncStatus> {
    unstable_noStore(); // Prevent caching for real-time updates
    const supabase = createAdminClient();

    const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'ghl_sync_status')
        .single();

    if (data?.value) {
        try {
            // value is text/json string in DB
            return JSON.parse(data.value);
        } catch (e) {
            console.error('Failed to parse sync status from DB:', e);
        }
    }

    return {
        state: 'idle',
        total: 0,
        processed: 0,
        synced: 0,
        matched_stripe: 0,
        unmatched_stripe: 0,
        errors: 0,
        last_updated: new Date().toISOString()
    };
}

export async function updateSyncStatus(status: SyncStatus) {
    const supabase = createAdminClient();

    try {
        await supabase
            .from('app_settings')
            .upsert({
                key: 'ghl_sync_status',
                value: JSON.stringify(status),
                updated_at: new Date().toISOString()
            });
    } catch (e) {
        console.error('[Sync Status] Failed to update status in DB:', e);
    }
}
