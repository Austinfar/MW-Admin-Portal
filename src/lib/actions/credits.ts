'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentUserAccess } from '@/lib/auth-utils'
import { startOfDay, endOfDay, format } from 'date-fns'

export interface CreditCheckResult {
    allowed: boolean
    limit: number
    used: number
    role: string
    error?: string
}

export async function checkSalesCallLimit(): Promise<CreditCheckResult> {
    const userAccess = await getCurrentUserAccess()

    if (!userAccess) {
        return { allowed: false, limit: 0, used: 0, role: 'unauthenticated', error: 'User not authenticated' }
    }

    const { role } = userAccess
    let limit = 2 // Default/Standard

    if (role === 'super_admin') {
        limit = Infinity
    } else if (role === 'admin') {
        limit = 10
    }

    // If super_admin, we can skip the DB count query for optimization,
    // but we might still want to know "used" count for display.
    // Let's always fetch used count for consistency in UI.

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { allowed: false, limit: 0, used: 0, role, error: 'User context missing' }
    }

    const todayStart = startOfDay(new Date()).toISOString()
    const todayEnd = endOfDay(new Date()).toISOString()

    const { count, error } = await supabase
        .from('sales_call_logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', todayStart)
        .lte('created_at', todayEnd)

    if (error) {
        console.error('Error checking sales call limit:', error)
        // Fail safe: allow if DB error? Or block? 
        // Safer to block or return error state.
        return { allowed: false, limit, used: 0, role, error: 'Failed to verify usage limits' }
    }

    const used = count || 0
    const allowed = used < limit

    return {
        allowed,
        limit,
        used,
        role
    }
}
