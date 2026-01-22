'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Helper function to log lead activity
async function logLeadActivity(
    supabase: any,
    leadId: string,
    action: string,
    details?: string
) {
    await supabase.from('activity_logs').insert({
        lead_id: leadId,
        action,
        details,
        created_at: new Date().toISOString()
    })
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

export async function convertLeadToClient(leadId: string) {
    const supabase = await createClient()

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

    // 2. Create Client (Simplified for now - might need more required fields)
    // IMPORTANT: Clients table usually requires 'ghl_contact_id'. 
    // If these are manual leads, they might not have one. 
    // We might need to generate a fake one or allow nullable.
    // For this MVP, let's assume we can insert minimal data.

    // Check constraints on clients table
    // Assuming ghl_contact_id is NOT NULL UNIQUE. We must generate a placeholder if missing.
    const placeholderGhlId = `manual_${Date.now()}_${Math.random().toString(36).substring(7)}`

    const { data: client, error: insertError } = await supabase
        .from('clients')
        .insert({
            name: `${lead.first_name} ${lead.last_name || ''}`.trim(),
            email: lead.email,
            phone: lead.phone,
            ghl_contact_id: placeholderGhlId,
            status: 'active', // or 'onboarding'
            start_date: new Date().toISOString().split('T')[0], // Default to today
            lead_source: 'coach_driven', // Default
            appointment_setter_id: (lead as any).booked_by_user_id || null // Transfer setter
        })
        .select()
        .single()

    if (insertError) {
        console.error('Error converting lead:', insertError)
        // Check for specific constraint errors
        if (insertError.code === '23505') { // Unique violation
            if (insertError.message.includes('email')) {
                return { error: 'A client with this email already exists.' }
            }
            if (insertError.message.includes('ghl_contact_id')) {
                // Retry logic for random ID collision (unlikely but possible)
                return { error: 'System ID collision, please try again.' }
            }
        }
        return { error: 'Failed to create client record: ' + insertError.message }
    }

    // Log conversion activity before migrating logs
    await logLeadActivity(
        supabase,
        leadId,
        'Converted to Client',
        `Lead was converted to client "${lead.first_name} ${lead.last_name || ''}".`
    )

    // 3. Migrate activity logs from lead to client
    if (client) {
        await supabase
            .from('activity_logs')
            .update({ client_id: client.id }) // Keep lead_id for reference or clear it? Keeping it allows tracing back.
            .eq('lead_id', leadId)

        // 4. Create "Client Note" from Lead Description if exists
        if (lead.description) {
            await supabase.from('client_notes').insert({
                client_id: client.id,
                content: `[Lead Note]: ${lead.description}`,
                is_pinned: false,
                // We don't have the original coach ID easily available here unless we pass it or infer it.
                // We'll leave author_id null or use a system user if possible, but schema might require it.
                // If logged in user is available... we can use that? 
                // But this runs on server. Let's try skipping author_id if nullable, or fetching current user.
            })
        }
    }

    // 5. Mark Lead as Converted (Soft Delete from view)
    await supabase.from('leads').update({ status: 'converted' }).eq('id', leadId)

    revalidatePath('/leads')
    revalidatePath('/clients')
    return { success: true }
}

