'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { startOfWeek, endOfWeek, format, subWeeks } from 'date-fns'

export interface CommissionReportItem {
    id: string
    client_id: string | null
    user_id: string
    role_in_sale: string
    split_percentage: number
    notes: string | null
    created_at: string
    coach: {
        name: string
        email: string
    } | null
    client: {
        name: string
    } | null
}

export async function getWeeklyCommissions(date: Date) {
    // Use Admin Client to bypass RLS on users table (which has recursive policy issue)
    const supabase = createAdminClient()
    const start = startOfWeek(date, { weekStartsOn: 0 }).toISOString() // Sunday
    const end = endOfWeek(date, { weekStartsOn: 0 }).toISOString() // Saturday

    const { data, error } = await supabase
        .from('commission_splits')
        .select(`
            *,
            coach:users!commission_splits_user_id_fkey(name, email),
            client:clients(name)
        `)
        .gte('created_at', start)
        .lte('created_at', end)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching weekly report:', error)
        return []
    }

    return data as unknown as CommissionReportItem[]
}
