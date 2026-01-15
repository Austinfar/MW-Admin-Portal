'use server'

import { createClient } from '@/lib/supabase/server'
import { Client } from '@/types/client'
import { revalidatePath, unstable_cache, revalidateTag } from 'next/cache'

import { createAdminClient } from '@/lib/supabase/admin'

async function _getClients() {
    // Using Admin Client to ensure all clients are visible regardless of complex RLS on joined tables
    const supabase = createAdminClient()

    const { data, error } = await supabase
        .from('clients')
        .select(`
      *,
      client_type:client_types(name),
      assigned_coach:users!clients_assigned_coach_id_fkey(name, email)
    `)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching clients:', JSON.stringify(error, null, 2))
        return []
    }

    return data as Client[]
}

export const getClients = unstable_cache(
    _getClients,
    ['all-clients'],
    {
        revalidate: 3600, // 1 hour (invalidated by mutations)
        tags: ['clients']
    }
);

export async function getClient(id: string) {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('clients')
        .select(`
      *,
      client_type:client_types(name),
      assigned_coach:users!clients_assigned_coach_id_fkey(name, email)
    `)
        .eq('id', id)
        .single()

    if (error) {
        console.error('Error fetching client:', error)
        return null
    }

    return data as Client
}

export async function getClientTypes() {
    const supabase = await createClient()

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
            assigned_coach_id: data.assigned_coach_id
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

    revalidatePath(`/clients/${id}`)
    revalidatePath('/clients')
    return { success: true }
}
