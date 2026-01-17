'use server'

import { createClient } from '@/lib/supabase/server'
import { Payment } from '@/types/payment'

export async function getClientPayments(
    clientId: string,
    options?: {
        email?: string;
        stripeCustomerId?: string | null;
    }
): Promise<Payment[]> {
    const supabase = await createClient()

    let query = supabase
        .from('payments')
        .select('*')
        .order('created_at', { ascending: false })

    // Build OR condition
    const conditions = [`client_id.eq.${clientId}`]

    if (options?.email) {
        conditions.push(`client_email.ilike.${options.email}`) // ilike for case insensitivity
    }

    if (options?.stripeCustomerId) {
        conditions.push(`stripe_customer_id.eq.${options.stripeCustomerId}`)
    }

    // Apply OR filter
    query = query.or(conditions.join(','))

    const { data, error } = await query

    if (error) {
        console.error('Error fetching payments:', error)
        return []
    }

    return (data || []) as Payment[]
}
