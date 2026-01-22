'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export interface SmsCheckinLog {
    id: string
    client_id: string
    ghl_contact_id: string
    message: string
    status: 'pending' | 'sent' | 'failed'
    error_message: string | null
    sent_at: string
    created_at: string
    client?: {
        name: string
        email: string
    }
}

export interface SmsLogsFilter {
    dateFrom?: string
    dateTo?: string
    status?: 'all' | 'sent' | 'failed' | 'pending'
}

export interface SmsLogsStats {
    total: number
    sent: number
    failed: number
    todaySent: number
    todayFailed: number
}

async function checkAdminAccess() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { authorized: false, error: 'Unauthorized' }

    const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

    if (!userData || !['admin', 'super_admin'].includes(userData.role)) {
        return { authorized: false, error: 'Unauthorized - Admin access required' }
    }

    return { authorized: true }
}

export async function getSmsCheckinLogs(
    limit = 50,
    offset = 0,
    filters?: SmsLogsFilter
): Promise<{ data: SmsCheckinLog[], total: number, error?: string }> {
    const access = await checkAdminAccess()
    if (!access.authorized) {
        return { data: [], total: 0, error: access.error }
    }

    const adminSupabase = createAdminClient()

    // Build query with filters
    let countQuery = adminSupabase
        .from('sms_checkin_logs')
        .select('*', { count: 'exact', head: true })

    let dataQuery = adminSupabase
        .from('sms_checkin_logs')
        .select(`
            *,
            client:clients(name, email)
        `)

    // Apply date filters
    if (filters?.dateFrom) {
        countQuery = countQuery.gte('sent_at', `${filters.dateFrom}T00:00:00Z`)
        dataQuery = dataQuery.gte('sent_at', `${filters.dateFrom}T00:00:00Z`)
    }
    if (filters?.dateTo) {
        countQuery = countQuery.lte('sent_at', `${filters.dateTo}T23:59:59Z`)
        dataQuery = dataQuery.lte('sent_at', `${filters.dateTo}T23:59:59Z`)
    }

    // Apply status filter
    if (filters?.status && filters.status !== 'all') {
        countQuery = countQuery.eq('status', filters.status)
        dataQuery = dataQuery.eq('status', filters.status)
    }

    // Get count
    const { count } = await countQuery

    // Get data
    const { data, error } = await dataQuery
        .order('sent_at', { ascending: false })
        .range(offset, offset + limit - 1)

    if (error) {
        console.error('Error fetching SMS logs:', error)
        return { data: [], total: 0, error: error.message }
    }

    return { data: data || [], total: count || 0 }
}

export async function getSmsLogsStats(): Promise<SmsLogsStats> {
    const adminSupabase = createAdminClient()

    const today = new Date().toISOString().split('T')[0]

    // Get all-time counts
    const { count: total } = await adminSupabase
        .from('sms_checkin_logs')
        .select('*', { count: 'exact', head: true })

    const { count: sent } = await adminSupabase
        .from('sms_checkin_logs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'sent')

    const { count: failed } = await adminSupabase
        .from('sms_checkin_logs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'failed')

    // Get today's counts
    const { count: todaySent } = await adminSupabase
        .from('sms_checkin_logs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'sent')
        .gte('sent_at', `${today}T00:00:00Z`)

    const { count: todayFailed } = await adminSupabase
        .from('sms_checkin_logs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'failed')
        .gte('sent_at', `${today}T00:00:00Z`)

    return {
        total: total || 0,
        sent: sent || 0,
        failed: failed || 0,
        todaySent: todaySent || 0,
        todayFailed: todayFailed || 0
    }
}

export async function updateSmsCheckinSettings(settings: {
    enabled?: boolean
    messageTemplate?: string
}): Promise<{ success?: boolean, error?: string }> {
    const access = await checkAdminAccess()
    if (!access.authorized) {
        return { error: access.error }
    }

    const adminSupabase = createAdminClient()

    if (settings.enabled !== undefined) {
        const { error } = await adminSupabase
            .from('app_settings')
            .upsert({
                key: 'sms_checkin_enabled',
                value: settings.enabled ? 'true' : 'false',
                updated_at: new Date().toISOString()
            })

        if (error) {
            console.error('Error updating SMS enabled setting:', error)
            return { error: 'Failed to update enabled setting' }
        }
    }

    if (settings.messageTemplate !== undefined) {
        const { error } = await adminSupabase
            .from('app_settings')
            .upsert({
                key: 'sms_checkin_message_template',
                value: settings.messageTemplate,
                updated_at: new Date().toISOString()
            })

        if (error) {
            console.error('Error updating SMS template:', error)
            return { error: 'Failed to update message template' }
        }
    }

    revalidatePath('/settings/sms-checkin')
    return { success: true }
}

export async function getSmsCheckinSettings(): Promise<{
    enabled: boolean
    messageTemplate: string
}> {
    const adminSupabase = createAdminClient()

    const { data } = await adminSupabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['sms_checkin_enabled', 'sms_checkin_message_template'])

    const settingsMap: Record<string, string> = {}
    data?.forEach(s => {
        settingsMap[s.key] = s.value
    })

    return {
        enabled: settingsMap['sms_checkin_enabled'] !== 'false',
        messageTemplate: settingsMap['sms_checkin_message_template'] || 'Hey {firstName}! Just checking in - how\'s your week going? Let us know if you need anything!'
    }
}
