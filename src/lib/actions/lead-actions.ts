'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { assignTemplateToClient } from '@/lib/actions/onboarding'

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
}) {
    const { firstName, lastName, email, phone, metadata, coachId } = data

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
                metadata: newMetadata,
                updated_at: new Date().toISOString()
            })
            .eq('id', existingLead.id)

        if (error) return { error: error.message }
    } else {
        // Create new lead
        const { data: newLead, error } = await supabase
            .from('leads')
            .insert({
                first_name: firstName,
                last_name: lastName,
                email: email,
                phone: phone,
                status: 'New',
                source: 'Web Form',
                assigned_user_id: coachId || null,
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
    const email = formData.get('email') as string
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
    const supabase = await createClient()

    const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', id)

    if (error) return { error: error.message }
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

        // 2. Create Client with full data (aligned with Stripe webhook pattern)
        const placeholderGhlId = `manual_${Date.now()}_${Math.random().toString(36).substring(7)}`

        const { data: client, error: insertError } = await supabase
            .from('clients')
            .insert({
                name: `${lead.first_name} ${lead.last_name || ''}`.trim(),
                email: lead.email,
                phone: lead.phone,
                ghl_contact_id: placeholderGhlId,
                status: 'onboarding', // Match Stripe path - start in onboarding
                start_date: new Date().toISOString().split('T')[0],
                lead_source: lead.source === 'Company' ? 'company_driven' : 'coach_driven',
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

