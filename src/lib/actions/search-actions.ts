
'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export type SearchResult = {
    type: 'client' | 'payment' | 'coach'
    id: string
    title: string
    subtitle: string
    status?: string
    date?: string
    amount?: number
    metadata?: Record<string, any>
}

export type GlobalSearchResults = {
    clients: SearchResult[]
    payments: SearchResult[]
    coaches: SearchResult[]
}

export async function searchGlobal(query: string): Promise<GlobalSearchResults> {
    if (!query || query.length < 2) {
        return { clients: [], payments: [], coaches: [] }
    }

    const supabaseAuth = await createClient()
    const { data: { user } } = await supabaseAuth.auth.getUser()
    console.log(`[Search] Query: "${query}" | User: ${user?.id || 'anon'}`)

    if (!user) {
        return { clients: [], payments: [], coaches: [] }
    }

    // Check role for "Users" search visibility
    const { data: profile } = await supabaseAuth
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

    // Use Admin Client to bypass RLS for actual search
    const supabase = createAdminClient()
    const searchQuery = `%${query}%`

    // 1. Search Clients
    const { data: clientsData } = await supabase
        .from('clients')
        .select('id, name, email, status, created_at')
        .or(`name.ilike.${searchQuery},email.ilike.${searchQuery}`)
        .limit(5)

    const clients: SearchResult[] = (clientsData || []).map((c: any) => ({
        type: 'client',
        id: c.id,
        title: c.name || 'Unknown',
        subtitle: c.email || '',
        status: c.status,
        date: c.created_at,
    }))

    // 2. Search Payments (including those belonging to found clients)
    const clientIds = (clientsData || []).map((c: any) => c.id)

    let paymentOrQuery = `client_email.ilike.${searchQuery},stripe_payment_id.ilike.${searchQuery}`
    if (clientIds.length > 0) {
        // Add client_id filter to the OR condition
        // precise syntax for mixing columns in OR: col1.op.val,col2.op.val
        paymentOrQuery += `,client_id.in.(${clientIds.join(',')})`
    }

    const { data: paymentsData } = await supabase
        .from('payments')
        .select(`
            id, 
            amount, 
            status, 
            payment_date, 
            client_email, 
            stripe_payment_id,
            client_id,
            clients ( name )
        `)
        .or(paymentOrQuery)
        .order('payment_date', { ascending: false })
        .limit(10)

    const payments: SearchResult[] = (paymentsData || []).map((p: any) => ({
        type: 'payment',
        id: p.id,
        title: p.clients?.name || p.client_email || 'Unknown Client',
        subtitle: p.stripe_payment_id || '',
        status: p.status,
        date: p.payment_date,
        amount: p.amount,
        metadata: { clientId: p.client_id }
    }))

    // 3. Search Coaches
    // 3. Search Users (Coaches/Admins) - ONLY IF ADMIN
    let coaches: SearchResult[] = []

    if (profile?.role === 'admin' || profile?.role === 'super_admin') {
        const { data: coachesData } = await supabase
            .from('users')
            .select('id, name, email, role')
            .in('role', ['coach', 'admin'])
            .or(`name.ilike.${searchQuery},email.ilike.${searchQuery}`)
            .limit(3)

        coaches = (coachesData || []).map((u: any) => ({
            type: 'coach',
            id: u.id,
            title: u.name || 'Unknown',
            subtitle: u.email || '',
            status: u.role,
            metadata: { role: u.role }
        }))
    }

    console.log(`[Search] Found: ${clients.length} clients, ${payments.length} payments, ${coaches.length} coaches`)

    return { clients, payments, coaches }
}
