'use server'

import { createClient } from '@/lib/supabase/server'
import { format, differenceInDays, parseISO } from 'date-fns'
import type { RenewalCalendarEvent, RenewalStatus } from '@/types/contract'

interface ExpiringClientsFilter {
    coachId?: string
    daysAhead?: number
    includeExpired?: boolean
}

/**
 * Get clients with contracts expiring within specified timeframe
 */
export async function getExpiringClients(
    filter: ExpiringClientsFilter = {}
): Promise<RenewalCalendarEvent[]> {
    const { coachId, daysAhead = 30, includeExpired = true } = filter

    const supabase = await createClient()

    // Query active contracts with their client and coach info
    let query = supabase
        .from('client_contracts')
        .select(`
            id,
            contract_number,
            end_date,
            program_name,
            client:clients!client_id (
                id,
                name,
                email,
                renewal_status,
                assigned_coach_id,
                assigned_coach:users!assigned_coach_id (
                    id,
                    name
                )
            )
        `)
        .eq('status', 'active')

    const { data: contracts, error } = await query

    if (error) {
        console.error('Error fetching expiring contracts:', error)
        return []
    }

    if (!contracts) return []

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const results: RenewalCalendarEvent[] = []

    for (const contract of contracts) {
        const client = contract.client as {
            id: string
            name: string
            email: string
            renewal_status: RenewalStatus | null
            assigned_coach_id: string | null
            assigned_coach: { id: string; name: string } | null
        }

        if (!client) continue

        // Filter by coach if specified
        if (coachId && client.assigned_coach_id !== coachId) continue

        const endDate = parseISO(contract.end_date)
        const daysUntil = differenceInDays(endDate, today)

        // Filter by days ahead
        if (daysUntil > daysAhead) continue
        if (!includeExpired && daysUntil < 0) continue

        results.push({
            clientId: client.id,
            clientName: client.name,
            clientEmail: client.email,
            coachId: client.assigned_coach_id,
            coachName: client.assigned_coach?.name || null,
            contractId: contract.id,
            contractNumber: contract.contract_number,
            contractEndDate: contract.end_date,
            programName: contract.program_name,
            renewalStatus: client.renewal_status || 'pending',
            daysUntilExpiration: daysUntil,
        })
    }

    // Sort by days until expiration (most urgent first)
    results.sort((a, b) => a.daysUntilExpiration - b.daysUntilExpiration)

    return results
}

/**
 * Update a client's renewal status
 */
export async function updateRenewalStatus(
    clientId: string,
    status: RenewalStatus
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()

    const { error } = await supabase
        .from('clients')
        .update({ renewal_status: status })
        .eq('id', clientId)

    if (error) {
        console.error('Error updating renewal status:', error)
        return { success: false, error: error.message }
    }

    return { success: true }
}

/**
 * Get clients that need renewal reminders sent
 * Returns clients at 30, 14, and 7 day marks who haven't been notified yet
 */
export async function getClientsNeedingReminders(): Promise<{
    thirtyDay: RenewalCalendarEvent[]
    fourteenDay: RenewalCalendarEvent[]
    sevenDay: RenewalCalendarEvent[]
}> {
    const supabase = await createClient()

    // Query active contracts with reminder tracking
    const { data: contracts, error } = await supabase
        .from('client_contracts')
        .select(`
            id,
            contract_number,
            end_date,
            program_name,
            total_value,
            monthly_rate,
            client:clients!client_id (
                id,
                name,
                email,
                renewal_status,
                renewal_reminders_sent,
                assigned_coach_id,
                assigned_coach:users!assigned_coach_id (
                    id,
                    name,
                    slack_user_id
                )
            )
        `)
        .eq('status', 'active')

    if (error) {
        console.error('Error fetching contracts for reminders:', error)
        return { thirtyDay: [], fourteenDay: [], sevenDay: [] }
    }

    if (!contracts) return { thirtyDay: [], fourteenDay: [], sevenDay: [] }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const thirtyDay: RenewalCalendarEvent[] = []
    const fourteenDay: RenewalCalendarEvent[] = []
    const sevenDay: RenewalCalendarEvent[] = []

    for (const contract of contracts) {
        const client = contract.client as {
            id: string
            name: string
            email: string
            renewal_status: RenewalStatus | null
            renewal_reminders_sent: { '30_day': string | null; '14_day': string | null; '7_day': string | null } | null
            assigned_coach_id: string | null
            assigned_coach: { id: string; name: string; slack_user_id: string | null } | null
        }

        if (!client) continue

        const endDate = parseISO(contract.end_date)
        const daysUntil = differenceInDays(endDate, today)
        const remindersSent = client.renewal_reminders_sent || { '30_day': null, '14_day': null, '7_day': null }

        const event: RenewalCalendarEvent & {
            coachSlackId?: string | null
            totalValue?: number | null
            monthlyRate?: number | null
        } = {
            clientId: client.id,
            clientName: client.name,
            clientEmail: client.email,
            coachId: client.assigned_coach_id,
            coachName: client.assigned_coach?.name || null,
            coachSlackId: client.assigned_coach?.slack_user_id || null,
            contractId: contract.id,
            contractNumber: contract.contract_number,
            contractEndDate: contract.end_date,
            programName: contract.program_name,
            renewalStatus: client.renewal_status || 'pending',
            daysUntilExpiration: daysUntil,
            totalValue: contract.total_value,
            monthlyRate: contract.monthly_rate,
        }

        // Check if at 30-day mark and not yet sent
        if (daysUntil <= 30 && daysUntil > 14 && !remindersSent['30_day']) {
            thirtyDay.push(event)
        }
        // Check if at 14-day mark and not yet sent
        else if (daysUntil <= 14 && daysUntil > 7 && !remindersSent['14_day']) {
            fourteenDay.push(event)
        }
        // Check if at 7-day mark (or less) and not yet sent
        else if (daysUntil <= 7 && !remindersSent['7_day']) {
            sevenDay.push(event)
        }
    }

    return { thirtyDay, fourteenDay, sevenDay }
}

/**
 * Mark a reminder as sent for a client
 */
export async function markReminderSent(
    clientId: string,
    reminderType: '30_day' | '14_day' | '7_day'
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()

    // Get current reminders_sent value
    const { data: client, error: fetchError } = await supabase
        .from('clients')
        .select('renewal_reminders_sent')
        .eq('id', clientId)
        .single()

    if (fetchError) {
        console.error('Error fetching client reminders:', fetchError)
        return { success: false, error: fetchError.message }
    }

    const currentReminders = client?.renewal_reminders_sent || {
        '30_day': null,
        '14_day': null,
        '7_day': null,
    }

    // Update with new reminder timestamp
    const updatedReminders = {
        ...currentReminders,
        [reminderType]: new Date().toISOString(),
    }

    const { error: updateError } = await supabase
        .from('clients')
        .update({ renewal_reminders_sent: updatedReminders })
        .eq('id', clientId)

    if (updateError) {
        console.error('Error updating reminder status:', updateError)
        return { success: false, error: updateError.message }
    }

    return { success: true }
}

/**
 * Get renewal stats for the dashboard
 */
export async function getRenewalStats(): Promise<{
    totalExpiring30Days: number
    critical: number
    urgent: number
    upcoming: number
    renewed: number
    churned: number
}> {
    const clients = await getExpiringClients({ daysAhead: 30 })

    const critical = clients.filter(c => c.daysUntilExpiration <= 7).length
    const urgent = clients.filter(c => c.daysUntilExpiration > 7 && c.daysUntilExpiration <= 14).length
    const upcoming = clients.filter(c => c.daysUntilExpiration > 14).length
    const renewed = clients.filter(c => c.renewalStatus === 'renewed').length
    const churned = clients.filter(c => c.renewalStatus === 'churned').length

    return {
        totalExpiring30Days: clients.length,
        critical,
        urgent,
        upcoming,
        renewed,
        churned,
    }
}
