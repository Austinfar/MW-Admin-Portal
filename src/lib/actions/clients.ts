'use server'

import { createClient } from '@/lib/supabase/server'
import { Client, ClientStats, EnhancedClient } from '@/types/client'
import { revalidatePath, unstable_cache } from 'next/cache'
import { subDays } from 'date-fns'

import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUserAccess } from '@/lib/auth-utils'

export async function getClients() {
    // Using Admin Client to ensure all clients are visible regardless of complex RLS on joined tables
    const supabase = createAdminClient()
    const userAccess = await getCurrentUserAccess()

    if (!userAccess) return []

    const permission = userAccess.permissions.can_view_clients
    if (!permission || permission === 'none') return []

    let query = supabase
        .from('clients')
        .select(`
      *,
      client_type:client_types(name),
      assigned_coach:users!clients_assigned_coach_id_fkey(name, email),
      sold_by_user:users!clients_sold_by_user_id_fkey(name, email),
      appointment_setter:users!clients_appointment_setter_id_fkey(name, email)
    `)
        .order('created_at', { ascending: false })

    // Enforce "own" permission scope
    if (permission === 'own') {
        const authClient = await createClient()
        const { data: { user } } = await authClient.auth.getUser()

        if (user) {
            query = query.or(`assigned_coach_id.eq.${user.id},appointment_setter_id.eq.${user.id},sold_by_user_id.eq.${user.id}`)
        } else {
            return []
        }
    }

    const { data, error } = await query

    if (error) {
        console.error('Error fetching clients:', JSON.stringify(error, null, 2))
        return []
    }

    return data as Client[]
}

export async function getClient(id: string) {
    // Use Admin Client to bypass RLS for detailed view, matching list view behavior
    const supabase = createAdminClient()

    const { data, error } = await supabase
        .from('clients')
        .select(`
      *,
      client_type:client_types(name),
      assigned_coach:users!clients_assigned_coach_id_fkey(name, email),
      sold_by_user:users!clients_sold_by_user_id_fkey(name, email),
      appointment_setter:users!clients_appointment_setter_id_fkey(name, email)
    `)
        .eq('id', id)
        .single()

    if (error) {
        console.error('Error fetching client:', error)
        return null
    }

    return data as Client
}

async function _getClientTypes() {
    const supabase = createAdminClient()

    const { data, error } = await supabase
        .from('client_types')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true })

    if (error) {
        console.error('Error fetching client types:', error)
        return []
    }

    return data
}

export const getClientTypes = unstable_cache(
    _getClientTypes,
    ['client-types'],
    { revalidate: 3600, tags: ['client_types'] }
)

export interface Coach {
    id: string
    name: string
    email: string
    role: string
    job_title: string
}

async function _getCoaches(): Promise<Coach[]> {
    const supabase = createAdminClient()

    const { data, error } = await supabase
        .from('users')
        .select('id, name, email, role, job_title')
        .eq('is_active', true)
        .in('job_title', ['coach', 'head_coach'])
        .order('name', { ascending: true })

    if (error) {
        console.error('Error fetching coaches:', error)
        return []
    }

    return data as Coach[]
}

export const getCoaches = unstable_cache(
    _getCoaches,
    ['coaches'],
    { revalidate: 300, tags: ['users', 'coaches'] }
)

import { assignTemplateToClient } from './onboarding'

// ... existing imports

export async function createManualClient(formData: FormData) {
    const supabase = await createClient()

    const name = formData.get('name') as string
    const email = formData.get('email') as string
    const phone = formData.get('phone') as string
    const clientTypeId = formData.get('clientTypeId') as string
    const startDate = formData.get('startDate') as string

    // Generate specific manual ID to satisfy unique constraint
    const manualId = `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const { data: client, error } = await supabase
        .from('clients')
        .insert({
            name,
            email,
            phone,
            client_type_id: clientTypeId === 'none' ? null : clientTypeId,
            start_date: startDate ? new Date(startDate).toISOString() : new Date().toISOString(),
            status: 'active',
            ghl_contact_id: manualId,
            lead_source: 'coach_driven'
        })
        .select()
        .single()

    if (error) {
        return { error: error.message }
    }

    // Auto-assign onboarding if template defaults exist
    if (clientTypeId && clientTypeId !== 'none') {
        const { data: clientType } = await supabase
            .from('client_types')
            .select('default_onboarding_template_id')
            .eq('id', clientTypeId)
            .single()

        if (clientType?.default_onboarding_template_id) {
            await assignTemplateToClient(client.id, clientType.default_onboarding_template_id)
        }
    }

    revalidatePath('/clients')
    // revalidateTag('clients') // TODO: Check Next.js 16 signature
    return { success: true }
}

import { updateGHLContact } from './ghl';

export async function updateClient(id: string, data: Partial<Client>) {
    const supabase = await createClient()

    // 1. Update Supabase
    const { error } = await supabase
        .from('clients')
        .update({
            name: data.name,
            email: data.email,
            phone: data.phone,
            status: data.status,
            contract_end_date: data.contract_end_date,
            client_type_id: data.client_type_id,
            assigned_coach_id: data.assigned_coach_id,
            stripe_customer_id: data.stripe_customer_id,
            ghl_contact_id: data.ghl_contact_id,
            sold_by_user_id: data.sold_by_user_id,
            lead_source: data.lead_source,
            check_in_day: data.check_in_day,
            appointment_setter_id: data.appointment_setter_id
        })
        .eq('id', id)

    if (error) {
        console.error('Error updating client in DB:', error)
        return { error: error.message }
    }

    // 2. Update GHL if linked
    if (data.ghl_contact_id) {
        // Prepare GHL payload
        // GHL expects specific field names
        const ghlPayload: any = {};
        if (data.name) {
            const parts = data.name.split(' ');
            ghlPayload.firstName = parts[0];
            ghlPayload.lastName = parts.slice(1).join(' ');
            ghlPayload.name = data.name;
        }
        if (data.email) ghlPayload.email = data.email;
        if (data.phone) ghlPayload.phone = data.phone;

        // Don't await strictly if we want faster UI response, but good to know errors
        const ghlResult = await updateGHLContact(data.ghl_contact_id, ghlPayload);
        if (ghlResult.error) {
            console.warn('Updated DB but failed to update GHL:', ghlResult.error);
            // We return success but maybe with a warning? Or just log it.
        }
    }

    // 3. Auto-assign onboarding if client type changed
    if (data.client_type_id) {
        const { data: clientType } = await supabase
            .from('client_types')
            .select('default_onboarding_template_id')
            .eq('id', data.client_type_id)
            .single()

        if (clientType?.default_onboarding_template_id) {
            await assignTemplateToClient(id, clientType.default_onboarding_template_id)
        }
    }

    revalidatePath(`/clients/${id}`)
    revalidatePath('/clients')
    return { success: true }
}

// Get enhanced client data with payment and onboarding info
async function _getEnhancedClients(): Promise<EnhancedClient[]> {
    const supabase = createAdminClient()
    const userAccess = await getCurrentUserAccess()

    // Default empty if no access
    if (!userAccess) return []
    const permission = userAccess.permissions.can_view_clients
    if (!permission || permission === 'none') return []

    // Get clients with basic data
    let query = supabase
        .from('clients')
        .select(`
            *,
            client_type:client_types(name),
            assigned_coach:users!clients_assigned_coach_id_fkey(name, email),
            sold_by_user:users!clients_sold_by_user_id_fkey(name, email),
            appointment_setter:users!clients_appointment_setter_id_fkey(name, email)
        `)
        .order('created_at', { ascending: false })

    // Apply 'own' filter
    if (permission === 'own') {
        const authClient = await createClient()
        const { data: { user } } = await authClient.auth.getUser()
        if (user) {
            query = query.or(`assigned_coach_id.eq.${user.id},appointment_setter_id.eq.${user.id},sold_by_user_id.eq.${user.id}`)
        } else {
            return []
        }
    }

    const { data: clients, error } = await query

    if (error) {
        console.error('Error fetching enhanced clients:', error)
        return []
    }

    // Get latest payments for all clients (with amount for LTV calculation)
    const { data: payments } = await supabase
        .from('payments')
        .select('client_id, payment_date, status, amount, refund_amount')
        .order('payment_date', { ascending: false })

    // Get onboarding task counts
    const { data: tasks } = await supabase
        .from('client_onboarding_tasks')
        .select('client_id, status')

    // Build lookup maps
    const latestPaymentMap = new Map<string, { date: string; status: string }>()
    const lifetimeRevenueMap = new Map<string, number>()
    payments?.forEach(p => {
        if (!latestPaymentMap.has(p.client_id)) {
            latestPaymentMap.set(p.client_id, { date: p.payment_date, status: p.status })
        }
        // Calculate lifetime revenue (successful payments minus refunds)
        if (p.status === 'succeeded' || p.status === 'refunded' || p.status === 'partially_refunded') {
            const currentRevenue = lifetimeRevenueMap.get(p.client_id) || 0
            const netAmount = (p.amount || 0) - (p.refund_amount || 0)
            lifetimeRevenueMap.set(p.client_id, currentRevenue + netAmount)
        }
    })

    const taskCountMap = new Map<string, { total: number; completed: number }>()
    tasks?.forEach(t => {
        const current = taskCountMap.get(t.client_id) || { total: 0, completed: 0 }
        current.total++
        if (t.status === 'completed') current.completed++
        taskCountMap.set(t.client_id, current)
    })

    // Merge data
    return clients.map(client => ({
        ...client,
        last_payment_date: latestPaymentMap.get(client.id)?.date || null,
        last_payment_status: latestPaymentMap.get(client.id)?.status || null,
        onboarding_total: taskCountMap.get(client.id)?.total || 0,
        onboarding_completed: taskCountMap.get(client.id)?.completed || 0,
        lifetime_revenue: lifetimeRevenueMap.get(client.id) || 0
    })) as EnhancedClient[]
}

export const getEnhancedClients = unstable_cache(
    _getEnhancedClients,
    ['enhanced-clients'],
    { revalidate: 60, tags: ['clients'] }
)

// Get client statistics for dashboard cards
async function _getClientStats(userId?: string, ownOnly?: boolean): Promise<ClientStats> {
    const supabase = createAdminClient()

    // Get all clients
    let query = supabase
        .from('clients')
        .select('id, status, contract_end_date, assigned_coach_id')

    if (ownOnly && userId) {
        query = query.eq('assigned_coach_id', userId)
    }

    const { data: clients, error } = await query

    if (error || !clients) {
        console.error('Error fetching client stats:', error)
        return { total: 0, active: 0, atRisk: 0, endingSoon: 0 }
    }

    const now = new Date()
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    // Get clients with failed payments in last 30 days
    const thirtyDaysAgo = subDays(now, 30)
    const { data: failedPayments } = await supabase
        .from('payments')
        .select('client_id')
        .eq('status', 'failed')
        .gte('payment_date', thirtyDaysAgo.toISOString())

    const failedPaymentClientIds = new Set(failedPayments?.map(p => p.client_id) || [])

    // Get clients with overdue onboarding tasks
    const { data: overdueTasks } = await supabase
        .from('client_onboarding_tasks')
        .select('client_id')
        .eq('status', 'pending')
        .lt('due_date', now.toISOString())

    const overdueTaskClientIds = new Set(overdueTasks?.map(t => t.client_id) || [])

    // Calculate stats
    const activeClients = clients.filter(c => c.status === 'active')

    const atRiskClients = activeClients.filter(c =>
        failedPaymentClientIds.has(c.id) || overdueTaskClientIds.has(c.id)
    )

    const endingSoonClients = activeClients.filter(c => {
        if (!c.contract_end_date) return false
        const endDate = new Date(c.contract_end_date)
        return endDate <= thirtyDaysFromNow && endDate >= now
    })

    return {
        total: clients.length,
        active: activeClients.length,
        atRisk: atRiskClients.length,
        endingSoon: endingSoonClients.length
    }
}

export const getClientStats = async (userId?: string, ownOnly?: boolean): Promise<ClientStats> => {
    const cacheKey = ownOnly && userId ? `client-stats-${userId}` : 'client-stats-all'
    const cachedFn = unstable_cache(
        () => _getClientStats(userId, ownOnly),
        [cacheKey],
        { revalidate: 120, tags: ['clients', 'client_stats'] }
    )
    return cachedFn()
}

// Bulk update client status
export async function bulkUpdateClientStatus(clientIds: string[], status: Client['status']) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('clients')
        .update({ status })
        .in('id', clientIds)

    if (error) {
        console.error('Error bulk updating client status:', error)
        return { error: error.message }
    }

    revalidatePath('/clients')
    return { success: true, updated: clientIds.length }
}

// Bulk reassign coach
export async function bulkReassignCoach(clientIds: string[], coachId: string | null) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('clients')
        .update({ assigned_coach_id: coachId })
        .in('id', clientIds)

    if (error) {
        console.error('Error bulk reassigning coach:', error)
        return { error: error.message }
    }

    revalidatePath('/clients')
    return { success: true, updated: clientIds.length }
}

export async function getClientActivityLogs(clientId: string) {
    const supabase = createAdminClient()

    const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching activity logs:', error)
        return []
    }

    return data
}
