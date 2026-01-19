'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getLeads() {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('leads')
        .select('*')
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

    const rawData = {
        first_name: formData.get('firstName') as string,
        last_name: formData.get('lastName') as string,
        email: formData.get('email') as string,
        phone: formData.get('phone') as string,
        status: 'New',
        source: 'Manual',
    }

    const { error } = await supabase
        .from('leads')
        .insert(rawData)

    if (error) {
        return { error: error.message }
    }

    revalidatePath('/leads')
    return { success: true }
}

export async function updateLeadStatus(id: string, status: string) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('leads')
        .update({ status })
        .eq('id', id)

    if (error) return { error: error.message }
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

export async function convertLeadToClient(leadId: string) {
    const supabase = await createClient()

    // 1. Get Lead
    const { data: lead, error: fetchError } = await supabase
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .single()

    if (fetchError || !lead) return { error: 'Lead not found' }

    // 2. Create Client (Simplified for now - might need more required fields)
    // IMPORTANT: Clients table usually requires 'ghl_contact_id'. 
    // If these are manual leads, they might not have one. 
    // We might need to generate a fake one or allow nullable.
    // For this MVP, let's assume we can insert minimal data.

    // Check constraints on clients table
    // Assuming ghl_contact_id is NOT NULL UNIQUE. We must generate a placeholder if missing.
    const placeholderGhlId = `manual_${Date.now()}_${Math.random().toString(36).substring(7)}`

    const { error: insertError } = await supabase
        .from('clients')
        .insert({
            name: `${lead.first_name} ${lead.last_name || ''}`.trim(),
            email: lead.email,
            phone: lead.phone,
            ghl_contact_id: placeholderGhlId,
            status: 'active', // or 'onboarding'
            start_date: new Date().toISOString().split('T')[0], // Default to today
            lead_source: 'coach_driven' // Default
        })

    if (insertError) {
        console.error('Error converting lead:', insertError)
        return { error: 'Failed to create client record: ' + insertError.message }
    }

    // 3. Delete Lead
    await supabase.from('leads').delete().eq('id', leadId)

    revalidatePath('/leads')
    revalidatePath('/clients')
    return { success: true }
}
