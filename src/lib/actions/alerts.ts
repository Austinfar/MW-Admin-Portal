'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { ClientAlert } from '@/types/client'

// Get all active alerts (non-dismissed)
export async function getActiveAlerts(userId?: string, ownOnly?: boolean): Promise<ClientAlert[]> {
    const supabase = createAdminClient()

    let query = supabase
        .from('client_alerts')
        .select(`
            *,
            client:clients(id, name, email, assigned_coach_id)
        `)
        .eq('is_dismissed', false)
        .order('created_at', { ascending: false })

    const { data, error } = await query

    if (error) {
        console.error('Error fetching alerts:', error)
        return []
    }

    // Filter by coach if ownOnly
    let alerts = data as any[]
    if (ownOnly && userId) {
        alerts = alerts.filter(a => a.client?.assigned_coach_id === userId)
    }

    return alerts.map(a => ({
        ...a,
        client: a.client ? { name: a.client.name, email: a.client.email } : null
    })) as ClientAlert[]
}

// Get alerts for a specific client
export async function getClientAlerts(clientId: string): Promise<ClientAlert[]> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('client_alerts')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching client alerts:', error)
        return []
    }

    return data as ClientAlert[]
}

// Get count of active alerts
export async function getAlertCount(userId?: string, ownOnly?: boolean): Promise<number> {
    const supabase = createAdminClient()

    const { data, error } = await supabase
        .from('client_alerts')
        .select(`
            id,
            client:clients(assigned_coach_id)
        `)
        .eq('is_dismissed', false)

    if (error) {
        console.error('Error fetching alert count:', error)
        return 0
    }

    if (ownOnly && userId) {
        return (data as any[]).filter(a => a.client?.assigned_coach_id === userId).length
    }

    return data?.length || 0
}

// Dismiss an alert
export async function dismissAlert(alertId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase
        .from('client_alerts')
        .update({
            is_dismissed: true,
            dismissed_by: user?.id,
            dismissed_at: new Date().toISOString()
        })
        .eq('id', alertId)

    if (error) {
        console.error('Error dismissing alert:', error)
        return { error: error.message }
    }

    revalidatePath('/clients')
    return { success: true }
}

// Dismiss all alerts for a client
export async function dismissClientAlerts(clientId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase
        .from('client_alerts')
        .update({
            is_dismissed: true,
            dismissed_by: user?.id,
            dismissed_at: new Date().toISOString()
        })
        .eq('client_id', clientId)
        .eq('is_dismissed', false)

    if (error) {
        console.error('Error dismissing client alerts:', error)
        return { error: error.message }
    }

    revalidatePath('/clients')
    revalidatePath(`/clients/${clientId}`)
    return { success: true }
}

// Create an alert manually (for testing or manual triggers)
export async function createAlert(
    clientId: string,
    alertType: ClientAlert['alert_type'],
    severity: ClientAlert['severity'],
    title: string,
    description?: string
) {
    const supabase = createAdminClient()

    const { data, error } = await supabase
        .from('client_alerts')
        .insert({
            client_id: clientId,
            alert_type: alertType,
            severity,
            title,
            description
        })
        .select()
        .single()

    if (error) {
        console.error('Error creating alert:', error)
        return { error: error.message }
    }

    revalidatePath('/clients')
    return { success: true, alert: data }
}

// Generate alerts (can be called from a cron endpoint)
export async function generateAlerts() {
    const supabase = createAdminClient()

    // Call the database function to generate alerts
    const { error } = await supabase.rpc('generate_client_alerts')

    if (error) {
        console.error('Error generating alerts:', error)
        return { error: error.message }
    }

    revalidatePath('/clients')
    return { success: true }
}
