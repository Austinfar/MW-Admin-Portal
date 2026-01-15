'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath, unstable_noStore } from 'next/cache';

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

export type SyncStatus = {
    state: 'idle' | 'syncing' | 'completed' | 'error';
    total: number;
    processed: number;
    errors: number;
    last_updated: string;
};

export async function getSyncStatus(): Promise<SyncStatus> {
    const settings = await getAppSettings();
    const rawStatus = settings['ghl_sync_status'];

    if (!rawStatus) {
        return {
            state: 'idle',
            total: 0,
            processed: 0,
            errors: 0,
            last_updated: new Date().toISOString()
        };
    }

    try {
        return JSON.parse(rawStatus);
    } catch (e) {
        return {
            state: 'idle',
            total: 0,
            processed: 0,
            errors: 0,
            last_updated: new Date().toISOString()
        };
    }
}

export async function updateSyncStatus(status: SyncStatus) {
    // Avoid revalidating path on every tick to prevent UI thrashing if we were using server components
    // But since we are polling form client, we just need to update DB.
    const supabase = createAdminClient();
    await supabase.from('app_settings').upsert({
        key: 'ghl_sync_status',
        value: JSON.stringify(status),
        updated_at: new Date().toISOString()
    });
}
