'use server'

import { createClient } from '@/lib/supabase/server'
import { startOfWeek, endOfWeek, format, subWeeks } from 'date-fns'

export interface CommissionReportItem {
    id: string
    payment_id: string
    coach_id: string
    role: string
    amount: number
    percentage: number
    created_at: string
    coach: {
        name: string
        email: string
    }
    payment: {
        amount: number
        client_id: string | null
        client: {
            name: string
        } | null
    }
}

export async function getWeeklyCommissions(date: Date) {
    const supabase = await createClient()
    const start = startOfWeek(date, { weekStartsOn: 0 }).toISOString() // Sunday
    const end = endOfWeek(date, { weekStartsOn: 0 }).toISOString() // Saturday

    const { data, error } = await supabase
        .from('commission_splits')
        .select(`
            *,
            coach:users(name, email),
            payment:payments(
                amount, 
                client_id,
                client:clients(name)
            )
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
