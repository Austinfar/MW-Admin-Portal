'use server'

import { createClient } from '@/lib/supabase/server'
import { Payment } from '@/types/payment'

export async function getClientPayments(clientId: string): Promise<Payment[]> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('client_id', clientId)
        .order('created', { ascending: false })

    if (error) {
        console.error('Error fetching payments:', error)
        return []
    }

    return (data || []) as Payment[]
}
