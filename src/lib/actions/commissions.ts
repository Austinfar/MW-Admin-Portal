'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface CommissionSetting {
    id: string
    setting_key: string
    setting_value: number
    description: string | null
    updated_at: string
}

import { createAdminClient } from '@/lib/supabase/admin'
import { unstable_cache, revalidateTag } from 'next/cache'

async function _getCommissionSettings() {
    const supabase = createAdminClient()

    const { data, error } = await supabase
        .from('commission_settings')
        .select('*')
        .order('setting_key')

    if (error) {
        console.error('Error fetching commission settings:', error)
        return []
    }

    return data as CommissionSetting[]
}

export const getCommissionSettings = unstable_cache(
    _getCommissionSettings,
    ['commission-settings'],
    {
        revalidate: 3600,
        tags: ['commissions']
    }
);

export async function updateCommissionSetting(key: string, value: number) {
    const supabase = await createClient()

    // Get current user for updated_by_id if needed, but schema optional?
    // Schema has updated_by_id. Let's try to set it.
    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase
        .from('commission_settings')
        .update({
            setting_value: value,
            updated_at: new Date().toISOString(),
            updated_by_id: user?.id
        })
        .eq('setting_key', key)

    if (error) {
        console.error('Error updating setting:', error)
        return { error: 'Failed to update setting' }
    }

    revalidatePath('/commissions/settings')
    // revalidateTag('commissions')
    return { success: true }
}
