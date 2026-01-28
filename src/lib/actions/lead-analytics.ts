'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { unstable_cache } from 'next/cache'
import type { EnhancedLead, LeadStats, LeadFunnelData, LeadSourceData } from '@/types/lead'

async function _getEnhancedLeads(): Promise<EnhancedLead[]> {
    const supabase = createAdminClient()

    const { data, error } = await supabase
        .from('leads')
        .select(`
            *,
            assigned_user:users!leads_assigned_user_id_fkey(id, name),
            booked_by_user:users!leads_booked_by_user_id_fkey(id, name)
        `)
        .neq('status', 'converted')
        .order('is_priority', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching enhanced leads:', error)
        return []
    }

    return data as EnhancedLead[]
}

export const getEnhancedLeads = unstable_cache(
    _getEnhancedLeads,
    ['enhanced-leads'],
    { revalidate: 60, tags: ['leads'] }
)

async function _getSettersAndClosers(): Promise<{ id: string; name: string; role: string }[]> {
    const supabase = createAdminClient()

    const { data, error } = await supabase
        .from('users')
        .select('id, name, role')
        .in('role', ['closer', 'setter', 'admin', 'owner'])
        .order('name')

    if (error) {
        console.error('Error fetching setters and closers:', error)
        return []
    }

    return data || []
}

export const getSettersAndClosers = unstable_cache(
    _getSettersAndClosers,
    ['setters-closers'],
    { revalidate: 300, tags: ['users'] }
)

async function _getLeadStats(): Promise<LeadStats> {
    const supabase = createAdminClient()

    const { data: leads, error } = await supabase
        .from('leads')
        .select('id, status, is_priority, metadata')
        .neq('status', 'converted')

    if (error || !leads) {
        console.error('Error fetching lead stats:', error)
        return { total: 0, priority: 0, booked: 0, bookingRate: 0, awaitingFollowUp: 0 }
    }

    const total = leads.length
    const priority = leads.filter(l => l.is_priority).length
    const booked = leads.filter(l => {
        const meta = l.metadata as Record<string, unknown> | null
        return meta?.consultation_scheduled_for || l.status === 'Appt Set'
    }).length
    const bookingRate = total > 0 ? Math.round((booked / total) * 100) : 0

    // Awaiting follow-up: New or Contacted leads older than 2 days without appointment
    const twoDaysAgo = new Date()
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
    const awaitingFollowUp = leads.filter(l => {
        if (!['New', 'Contacted'].includes(l.status)) return false
        const meta = l.metadata as Record<string, unknown> | null
        if (meta?.consultation_scheduled_for) return false
        return true
    }).length

    return { total, priority, booked, bookingRate, awaitingFollowUp }
}

export const getLeadStats = unstable_cache(
    _getLeadStats,
    ['lead-stats'],
    { revalidate: 60, tags: ['leads', 'lead_stats'] }
)

async function _getLeadFunnelData(period: '7d' | '30d' | 'all' = '30d'): Promise<LeadFunnelData> {
    const supabase = createAdminClient()

    let query = supabase
        .from('leads')
        .select('id, status, metadata, created_at')
    // removed .neq('status', 'converted') so we count sold clients

    // Apply time filter
    if (period !== 'all') {
        const daysAgo = period === '7d' ? 7 : 30
        const startDate = new Date()
        startDate.setDate(startDate.getDate() - daysAgo)
        query = query.gte('created_at', startDate.toISOString())
    }

    const { data: leads, error } = await query

    if (error || !leads) {
        console.error('Error fetching funnel data:', error)
        return {
            contactsSubmitted: 0,
            coachSelected: 0,
            callBooked: 0,
            questionnaireDone: 0,
            closedWon: 0,
            conversionRate: 0,
            period
        }
    }

    const contactsSubmitted = leads.length
    const coachSelected = leads.filter(l => {
        const meta = l.metadata as Record<string, unknown> | null
        return meta?.coach_selected || meta?.coach_selected_id
    }).length
    const callBooked = leads.filter(l => {
        const meta = l.metadata as Record<string, unknown> | null
        return meta?.consultation_scheduled_for || l.status === 'Appt Set'
    }).length
    const questionnaireDone = leads.filter(l => {
        const meta = l.metadata as Record<string, unknown> | null
        return meta?.questionnaire_completed_at || meta?.questionnaire
    }).length
    // "Closed Won" corresponds to "Sold" (converted leads + legacy 'Closed Won' status if any)
    const closedWon = leads.filter(l => l.status === 'converted' || l.status === 'Closed Won').length

    const conversionRate = contactsSubmitted > 0
        ? Math.round((closedWon / contactsSubmitted) * 1000) / 10
        : 0

    return {
        contactsSubmitted,
        coachSelected,
        callBooked,
        questionnaireDone,
        closedWon,
        conversionRate,
        period
    }
}

// Cached versions for each period
export const getLeadFunnelData = async (period: '7d' | '30d' | 'all' = '30d'): Promise<LeadFunnelData> => {
    const cachedFn = unstable_cache(
        () => _getLeadFunnelData(period),
        [`lead-funnel-${period}`],
        { revalidate: 120, tags: ['leads', 'lead_funnel'] }
    )
    return cachedFn()
}

async function _getLeadSourceBreakdown(): Promise<LeadSourceData[]> {
    const supabase = createAdminClient()

    const { data: leads, error } = await supabase
        .from('leads')
        .select('source')
        .neq('status', 'converted')

    if (error || !leads) {
        console.error('Error fetching source breakdown:', error)
        return []
    }

    // Count by source
    const sourceCounts: Record<string, number> = {}
    leads.forEach(lead => {
        const source = lead.source || 'Unknown'
        sourceCounts[source] = (sourceCounts[source] || 0) + 1
    })

    const total = leads.length
    const sourceData: LeadSourceData[] = Object.entries(sourceCounts)
        .map(([source, count]) => ({
            source,
            count,
            percentage: total > 0 ? Math.round((count / total) * 100) : 0
        }))
        .sort((a, b) => b.count - a.count)

    return sourceData
}

export const getLeadSourceBreakdown = unstable_cache(
    _getLeadSourceBreakdown,
    ['lead-source-breakdown'],
    { revalidate: 120, tags: ['leads', 'lead_sources'] }
)
