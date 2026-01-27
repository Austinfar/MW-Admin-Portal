'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath, unstable_cache } from 'next/cache'
import { assignTemplateToClient } from '@/lib/actions/onboarding'
import { pushToGHL } from '@/lib/services/ghl'

// Helper function to log lead activity
// Helper function to log lead activity
export async function logLeadActivity(
    supabase: any,
    leadId: string,
    action: string,
    details?: string
) {
    await supabase.from('activity_logs').insert({
        lead_id: leadId,
        type: action,
        description: details,
        created_at: new Date().toISOString()
    })
}

// Internal reusable function for lead submission/upsert
export async function upsertLead(supabase: any, data: {
    firstName: string
    lastName: string
    email: string
    phone: string
    metadata?: Record<string, any>
    coachId?: string
    setterId?: string
}) {
    const { firstName, lastName, email: rawEmail, phone, metadata, coachId, setterId } = data
    const email = rawEmail.toLowerCase()

    // Check if lead exists
    const { data: existingLead } = await supabase
        .from('leads')
        .select('id, metadata')
        .eq('email', email)
        .single()

    let leadId = existingLead?.id

    if (existingLead) {
        // Update existing lead
        const newMetadata = {
            ...(existingLead.metadata as object || {}),
            ...(metadata || {}),
            last_submission: new Date().toISOString()
        }

        const { error } = await supabase
            .from('leads')
            .update({
                first_name: firstName,
                last_name: lastName,
                phone: phone,
                booked_by_user_id: setterId || undefined, // Only update if provided? Or should we always? Let's use undefined to skip if not passed, but here it is passed.
                // However, update might overwrite existing setter if we pass null. 
                // Let's safe-guard: if setterId is passed, update it.
                ...(setterId ? { booked_by_user_id: setterId } : {}),
                ...(metadata?.source || metadata?.utm_source ? { source: metadata?.utm_source || metadata?.source } : {}),
                metadata: newMetadata,
                updated_at: new Date().toISOString()
            })
            .eq('id', existingLead.id)

        if (error) return { error: error.message }
    } else {
        // Create new lead
        const leadSource = metadata?.utm_source || metadata?.source || 'Web Form'

        const { data: newLead, error } = await supabase
            .from('leads')
            .insert({
                first_name: firstName,
                last_name: lastName,
                email: email,
                phone: phone,
                status: 'New',
                source: leadSource,
                assigned_user_id: coachId || null,
                booked_by_user_id: setterId || null,
                metadata: {
                    ...(metadata || {}),
                    source_detail: 'Landing Page Submission'
                }
            })
            .select('id')
            .single()

        if (error) return { error: error.message }
        leadId = newLead.id
    }



    if (leadId) {
        // Log activity
        await logLeadActivity(
            supabase,
            leadId,
            existingLead ? 'Form Resubmitted' : 'Lead Form Submitted',
            existingLead ? 'Lead updated via landing page form.' : 'New lead created via landing page form.'
        )

        // If questionnaire answers present, log that specifically
        if (metadata?.questionnaire) {
            await logLeadActivity(
                supabase,
                leadId,
                'Questionnaire Submitted',
                'Client submitted questionnaire answers.'
            )
        }

        // Sync to GHL immediately
        try {
            const tags = ['landing_page_submission']
            if (metadata?.questionnaire) tags.push('questionnaire_submitted')

            // Prepare GHL payload
            const ghlData: any = {
                email,
                firstName,
                lastName,
                phone,
                tags
            }

            // Only set status for new leads to avoid resetting pipeline stage for existing leads
            if (!existingLead) {
                ghlData.status = 'New'
            }

            const ghlResult = await pushToGHL(ghlData)

            if (ghlResult.error) {
                console.error('[lead-actions] GHL Sync returned error:', ghlResult)
            }

            if (ghlResult.ghlContactId) {
                const updates: any = { ghl_contact_id: ghlResult.ghlContactId }
                if (ghlResult.ghlOpportunityId) {
                    updates.ghl_opportunity_id = ghlResult.ghlOpportunityId
                }
                await supabase.from('leads').update(updates).eq('id', leadId)
            }
        } catch (error) {
            console.error('GHL Direct Sync Failed:', error)
        }
    }

    return { success: true, leadId }
}

export async function getLeads() {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('leads')
        .select('*')
        .neq('status', 'converted') // Filter out converted leads
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching leads:', JSON.stringify(error, null, 2))
        return []
    }

    return data
}

export async function getLead(id: string) {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('id', id)
        .single()

    if (error) {
        console.error('Error fetching lead:', JSON.stringify(error, null, 2))
        return null
    }

    return data
}

export async function createLead(formData: FormData) {
    const supabase = await createClient()

    const firstName = formData.get('firstName') as string
    const lastName = formData.get('lastName') as string
    const email = (formData.get('email') as string).toLowerCase()
    const phone = formData.get('phone') as string

    const rawData = {
        first_name: firstName,
        last_name: lastName,
        email: email,
        phone: phone,
        status: 'New',
        source: 'Manual',
    }

    const { data: lead, error } = await supabase
        .from('leads')
        .insert(rawData)
        .select()
        .single()

    if (error) {
        return { error: error.message }
    }

    // Log activity for lead creation
    await logLeadActivity(
        supabase,
        lead.id,
        'Lead Created',
        `${firstName} ${lastName || ''} was added as a new lead.`
    )

    // Sync to GHL immediately
    try {
        const ghlResult = await pushToGHL({
            email,
            firstName,
            lastName,
            phone,
            status: 'New',
            tags: ['manual_entry']
        });

        if (ghlResult.ghlContactId) {
            await supabase.from('leads').update({ ghl_contact_id: ghlResult.ghlContactId }).eq('id', lead.id);
        }
    } catch (err) {
        console.error('Manual GHL Sync Failed:', err);
    }

    revalidatePath('/leads')
    return { success: true }
}

export async function submitLead(data: {
    firstName: string
    lastName: string
    email: string
    phone: string
    metadata?: Record<string, any>
    coachId?: string
}) {
    const supabase = await createClient()
    const result = await upsertLead(supabase, data)

    if (result.success) {
        revalidatePath('/leads')
    }

    return result
}

export async function updateLeadStatus(id: string, status: string) {
    const supabase = await createClient()

    // Get current lead info for activity log
    const { data: lead } = await supabase
        .from('leads')
        .select('first_name, last_name, status')
        .eq('id', id)
        .single()

    const oldStatus = lead?.status || 'Unknown'

    const { error } = await supabase
        .from('leads')
        .update({ status })
        .eq('id', id)

    if (error) return { error: error.message }

    // Log status change
    await logLeadActivity(
        supabase,
        id,
        'Status Changed',
        `Status updated from "${oldStatus}" to "${status}".`
    )

    revalidatePath('/leads')
    return { success: true }
}

export async function deleteLead(id: string) {
    const supabase = createAdminClient()

    // First check if lead exists
    const { data: lead, error: fetchError } = await supabase
        .from('leads')
        .select('id, first_name, last_name')
        .eq('id', id)
        .single()

    if (fetchError || !lead) {
        return { error: 'Lead not found' }
    }

    // Check for related records that would block deletion
    const { data: paymentSchedules } = await supabase
        .from('payment_schedules')
        .select('id')
        .eq('lead_id', id)
        .limit(1)

    if (paymentSchedules && paymentSchedules.length > 0) {
        return { error: 'Cannot delete: Lead has payment schedules. Remove them first.' }
    }

    // Attempt delete
    const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', id)

    if (error) {
        console.error('Delete lead error:', error)
        // Handle specific error codes
        if (error.code === '23503') {
            return { error: 'Cannot delete: Lead has related records in other tables.' }
        }
        return { error: error.message }
    }

    revalidatePath('/leads')
    return { success: true }
}

export async function updateLeadAppointmentSetter(leadId: string, setterId: string | null) {
    const supabase = await createClient()

    // Get current lead info for activity log
    const { data: lead } = await supabase
        .from('leads')
        .select('first_name, last_name, booked_by_user_id')
        .eq('id', leadId)
        .single()

    if (!lead) return { error: 'Lead not found' }

    // Get setter name for activity log
    let setterName = 'None'
    if (setterId) {
        const { data: setter } = await supabase
            .from('users')
            .select('name')
            .eq('id', setterId)
            .single()
        setterName = setter?.name || 'Unknown'
    }

    const { error } = await supabase
        .from('leads')
        .update({ booked_by_user_id: setterId })
        .eq('id', leadId)

    if (error) return { error: error.message }

    // Log activity
    await logLeadActivity(
        supabase,
        leadId,
        'Appointment Setter Updated',
        `Appointment setter changed to "${setterName}".`
    )

    revalidatePath('/leads')
    revalidatePath(`/leads/${leadId}`)
    return { success: true }
}

/**
 * Convert a lead to a client with full onboarding flow.
 * Aligns with the Stripe webhook conversion path for consistency.
 */
export async function convertLeadToClient(
    leadId: string,
    options?: {
        templateId?: string
        assignedCoachId?: string
        clientTypeId?: string
    }
): Promise<{ success?: boolean; clientId?: string; error?: string }> {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    let createdClientId: string | null = null
    let createdNoteId: string | null = null

    try {
        // 1. Get Lead
        const { data: lead, error: fetchError } = await supabase
            .from('leads')
            .select('*')
            .eq('id', leadId)
            .single()

        if (fetchError || !lead) {
            console.error('Error fetching lead during conversion:', fetchError)
            return { error: 'Lead not found' }
        }

        // Determine coach ID - from options, lead's assigned user, or booked_by user
        const assignedCoachId = options?.assignedCoachId ||
            (lead as any).assigned_user_id ||
            (lead as any).booked_by_user_id ||
            null

        // 2. Determine GHL Contact ID
        let finalGhlId = lead.ghl_contact_id

        // If lead doesn't have a GHL ID, try to sync it now to get one
        if (!finalGhlId) {
            console.log('Lead has no GHL ID, attempting to sync with GHL before conversion...')
            try {
                const ghlResult = await pushToGHL({
                    email: lead.email,
                    firstName: lead.first_name,
                    lastName: lead.last_name || '',
                    phone: lead.phone || '',
                    status: lead.status || 'New'
                })

                if (ghlResult.ghlContactId) {
                    finalGhlId = ghlResult.ghlContactId
                    // Update the lead record with this new ID too so we remain consistent
                    await supabase.from('leads').update({ ghl_contact_id: finalGhlId }).eq('id', leadId)
                }
            } catch (syncError) {
                console.error('Failed to sync with GHL during conversion:', syncError)
            }
        }

        // Fallback to placeholder if we absolutely cannot get a GHL ID (to satisfy DB constraint)
        if (!finalGhlId) {
            finalGhlId = `manual_${Date.now()}_${Math.random().toString(36).substring(7)}`
            console.warn(`Using manual placeholder ID for client conversion: ${finalGhlId}`)
        }

        // 3. Create Client with full data
        const { data: client, error: insertError } = await supabase
            .from('clients')
            .insert({
                name: `${lead.first_name} ${lead.last_name || ''}`.trim(),
                email: lead.email,
                phone: lead.phone,
                ghl_contact_id: finalGhlId,
                status: 'onboarding', // Match Stripe path - start in onboarding
                start_date: new Date().toISOString().split('T')[0],
                // Logic update: Default to 'company_driven' (Company Gen) for Web Forms, Ads, etc.
                // Only mark as 'coach_driven' if explicitly 'Coach' or 'Referral' or similar.
                lead_source: (lead.source === 'Coach' || lead.source === 'Manuel' || lead.source === 'Referral' || lead.source === 'Self-Gen')
                    ? 'coach_driven'
                    : 'company_driven',
                appointment_setter_id: (lead as any).booked_by_user_id || null,
                assigned_coach_id: assignedCoachId,
                client_type_id: options?.clientTypeId || null,
                // Initialize coach_history array (same as Stripe webhook)
                coach_history: assignedCoachId ? [{
                    coach_id: assignedCoachId,
                    start_date: new Date().toISOString().split('T')[0],
                    end_date: null
                }] : []
            })
            .select()
            .single()

        if (insertError) {
            console.error('Error converting lead:', insertError)
            if (insertError.code === '23505') {
                if (insertError.message.includes('email')) {
                    return { error: 'A client with this email already exists.' }
                }
                if (insertError.message.includes('ghl_contact_id')) {
                    return { error: 'System ID collision, please try again.' }
                }
            }
            return { error: 'Failed to create client record: ' + insertError.message }
        }

        createdClientId = client.id

        // 3. Create "Client Note" from Lead Description if exists
        if (lead.description) {
            const { data: note } = await supabase
                .from('client_notes')
                .insert({
                    client_id: client.id,
                    content: `[Lead Note]: ${lead.description}`,
                    is_pinned: false,
                })
                .select('id')
                .single()

            if (note) {
                createdNoteId = note.id
            }
        }

        // 4. Assign onboarding template
        let templateId = options?.templateId

        // If no template specified but client type specified, get default template
        if (!templateId && options?.clientTypeId) {
            const { data: clientType } = await supabase
                .from('client_types')
                .select('default_onboarding_template_id')
                .eq('id', options.clientTypeId)
                .single()

            templateId = clientType?.default_onboarding_template_id || undefined
        }

        // If still no template, try to get the standard onboarding template
        if (!templateId) {
            const { data: defaultTemplate } = await supabase
                .from('onboarding_templates')
                .select('id')
                .ilike('name', '%standard%')
                .limit(1)
                .single()

            templateId = defaultTemplate?.id
        }

        // Assign template if found
        if (templateId) {
            const templateResult = await assignTemplateToClient(client.id, templateId)
            if (templateResult.error) {
                console.warn('Template assignment failed (non-fatal):', templateResult.error)
            }
        }

        // 5. Log conversion activity
        await supabase.from('activity_logs').insert({
            client_id: client.id,
            lead_id: leadId,
            type: 'conversion',
            description: `Converted from Lead to Client (manual conversion)`,
            metadata: { source: 'manual_conversion' }
        })

        // 6. Migrate activity logs from lead to client
        await supabase
            .from('activity_logs')
            .update({ client_id: client.id })
            .eq('lead_id', leadId)
            .is('client_id', null)

        // 7. Mark Lead as Converted
        await supabase
            .from('leads')
            .update({ status: 'converted' })
            .eq('id', leadId)

        revalidatePath('/leads')
        revalidatePath('/clients')
        revalidatePath('/onboarding')
        return { success: true, clientId: client.id }

    } catch (error) {
        console.error('Conversion failed, attempting rollback:', error)

        // Rollback: Delete created records
        if (createdClientId) {
            // Delete onboarding tasks created for this client
            await adminClient
                .from('onboarding_tasks')
                .delete()
                .eq('client_id', createdClientId)

            // Delete client note
            if (createdNoteId) {
                await adminClient
                    .from('client_notes')
                    .delete()
                    .eq('id', createdNoteId)
            }

            // Delete activity logs for this client
            await adminClient
                .from('activity_logs')
                .delete()
                .eq('client_id', createdClientId)

            // Delete the client
            await adminClient
                .from('clients')
                .delete()
                .eq('id', createdClientId)
        }

        return {
            error: error instanceof Error ? error.message : 'Conversion failed, changes rolled back'
        }
    }
}

export async function getLeadActivity(leadId: string) {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching lead activity:', error)
        return []
    }

    return data
}

// ============================================
// Enhanced Lead Functions for Killer Leads Page
// ============================================

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

export async function bulkUpdateLeadStatus(leadIds: string[], status: string) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('leads')
        .update({ status, updated_at: new Date().toISOString() })
        .in('id', leadIds)

    if (error) {
        console.error('Error bulk updating lead status:', error)
        return { error: error.message }
    }

    revalidatePath('/leads')
    return { success: true, updated: leadIds.length }
}

export async function bulkAssignUser(
    leadIds: string[],
    userId: string | null,
    type: 'setter' | 'closer'
) {
    const supabase = await createClient()

    const updateField = type === 'setter' ? 'booked_by_user_id' : 'assigned_user_id'

    const { error } = await supabase
        .from('leads')
        .update({ [updateField]: userId, updated_at: new Date().toISOString() })
        .in('id', leadIds)

    if (error) {
        console.error(`Error bulk assigning ${type}:`, error)
        return { error: error.message }
    }

    revalidatePath('/leads')
    return { success: true, updated: leadIds.length }
}

export async function bulkDeleteLeads(leadIds: string[]) {
    const supabase = createAdminClient()

    // Check for leads with payment schedules
    const { data: blockedLeads } = await supabase
        .from('payment_schedules')
        .select('lead_id')
        .in('lead_id', leadIds)

    if (blockedLeads && blockedLeads.length > 0) {
        const blockedCount = new Set(blockedLeads.map(b => b.lead_id)).size
        return { error: `Cannot delete: ${blockedCount} lead(s) have payment schedules. Remove them first.` }
    }

    const { error } = await supabase
        .from('leads')
        .delete()
        .in('id', leadIds)

    if (error) {
        console.error('Error bulk deleting leads:', error)
        if (error.code === '23503') {
            return { error: 'Cannot delete: Some leads have related records in other tables.' }
        }
        return { error: error.message }
    }

    revalidatePath('/leads')
    return { success: true, deleted: leadIds.length }
}

export async function bulkTogglePriority(leadIds: string[], isPriority: boolean) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('leads')
        .update({ is_priority: isPriority, updated_at: new Date().toISOString() })
        .in('id', leadIds)

    if (error) {
        console.error('Error bulk toggling priority:', error)
        return { error: error.message }
    }

    revalidatePath('/leads')
    return { success: true, updated: leadIds.length }
}

export async function toggleLeadPriority(leadId: string) {
    const supabase = await createClient()

    // Get current priority
    const { data: lead } = await supabase
        .from('leads')
        .select('is_priority')
        .eq('id', leadId)
        .single()

    const newPriority = !(lead?.is_priority ?? false)

    const { error } = await supabase
        .from('leads')
        .update({ is_priority: newPriority, updated_at: new Date().toISOString() })
        .eq('id', leadId)

    if (error) {
        console.error('Error toggling lead priority:', error)
        return { error: error.message }
    }

    revalidatePath('/leads')
    revalidatePath(`/leads/${leadId}`)
    return { success: true, is_priority: newPriority }
}

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

export async function createFollowUpTask(
    leadId: string,
    taskData: {
        taskType: 'call' | 'email' | 'sms' | 'other'
        scheduledFor: string
        notes?: string
    }
) {
    const supabase = await createClient()

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    // Log as activity for now (could integrate with a dedicated tasks table)
    await logLeadActivity(
        supabase,
        leadId,
        'Follow-up Scheduled',
        `${taskData.taskType.charAt(0).toUpperCase() + taskData.taskType.slice(1)} follow-up scheduled for ${new Date(taskData.scheduledFor).toLocaleDateString()}${taskData.notes ? `: ${taskData.notes}` : ''}`
    )

    revalidatePath('/leads')
    revalidatePath(`/leads/${leadId}`)
    return { success: true }
}

export async function addToCallQueue(leadId: string) {
    const supabase = await createClient()

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    // Log as activity
    await logLeadActivity(
        supabase,
        leadId,
        'Added to Call Queue',
        'Lead added to today\'s call queue for immediate follow-up.'
    )

    revalidatePath('/leads')
    revalidatePath(`/leads/${leadId}`)
    return { success: true }
}

export async function updateLeadNotes(leadId: string, notes: string) {
    const supabase = createAdminClient()

    const { error } = await supabase
        .from('leads')
        .update({
            description: notes,
            updated_at: new Date().toISOString()
        })
        .eq('id', leadId)

    if (error) {
        console.error('Error updating lead notes:', error)
        return { error: error.message }
    }

    // Log activity
    await logLeadActivity(supabase, leadId, 'Notes Updated', 'Lead notes were updated')

    revalidatePath('/leads')
    revalidatePath(`/leads/${leadId}`)
    return { success: true }
}

export async function updateLeadCloser(leadId: string, closerId: string | null) {
    const supabase = createAdminClient()

    // Get closer name for activity log
    let closerName = 'None'
    if (closerId) {
        const { data: closer } = await supabase
            .from('users')
            .select('name')
            .eq('id', closerId)
            .single()
        closerName = closer?.name || 'Unknown'
    }

    const { error } = await supabase
        .from('leads')
        .update({
            assigned_user_id: closerId,
            updated_at: new Date().toISOString()
        })
        .eq('id', leadId)

    if (error) {
        console.error('Error updating lead closer:', error)
        return { error: error.message }
    }

    // Log activity
    await logLeadActivity(
        supabase,
        leadId,
        'Closer Assigned',
        `Closer changed to ${closerName}`
    )

    revalidatePath('/leads')
    revalidatePath(`/leads/${leadId}`)
    return { success: true }
}

export async function markLeadNoShow(leadId: string) {
    const supabase = createAdminClient()

    const { error } = await supabase
        .from('leads')
        .update({
            status: 'No Show',
            updated_at: new Date().toISOString()
        })
        .eq('id', leadId)

    if (error) {
        console.error('Error marking lead as no show:', error)
        return { error: error.message }
    }

    // Log activity
    await logLeadActivity(
        supabase,
        leadId,
        'Status Changed',
        'Lead marked as No Show - did not attend scheduled consultation'
    )

    revalidatePath('/leads')
    revalidatePath(`/leads/${leadId}`)
    return { success: true }
}


