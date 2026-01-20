'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function getClientNotes(clientId: string) {
    // Use Admin Client to bypass RLS on users table (which has recursive policy issue)
    const supabase = createAdminClient()

    const { data, error } = await supabase
        .from('client_notes')
        .select(`
      *,
      author:users(name, email, id, avatar_url)
    `)
        .eq('client_id', clientId)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching notes:', error)
        return []
    }

    return data
}

export async function createNote(clientId: string, content: string) {
    const supabase = await createClient()

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        throw new Error('Unauthorized')
    }

    const { data: note, error } = await supabase
        .from('client_notes')
        .insert({
            client_id: clientId,
            content,
            author_id: user.id,
        })
        .select()
        .single()

    if (error) {
        throw new Error('Failed to create note')
    }

    // Sync to GHL
    try {
        const { data: client } = await supabase
            .from('clients')
            .select('ghl_contact_id')
            .eq('id', clientId)
            .single()

        if (client?.ghl_contact_id) {
            const { GHLClient } = await import('@/lib/ghl/client')
            const ghl = new GHLClient()
            const response = await ghl.createNote(client.ghl_contact_id, content)

            if (response?.note?.id) {
                await supabase
                    .from('client_notes')
                    .update({
                        ghl_note_id: response.note.id,
                        last_synced_at: new Date().toISOString()
                    })
                    .eq('id', note.id)
            }
        }
    } catch (syncError) {
        console.error('Failed to sync note to GHL:', syncError)
        // Don't fail the request, just log it
    }

    revalidatePath(`/dashboard/clients/${clientId}`)
}

export async function deleteNote(noteId: string, clientId: string) {
    const supabase = await createClient()

    // Get note details first for GHL sync
    const { data: note } = await supabase
        .from('client_notes')
        .select(`
            *,
            client:clients(ghl_contact_id)
        `)
        .eq('id', noteId)
        .single()

    const { error } = await supabase
        .from('client_notes')
        .delete()
        .eq('id', noteId)

    if (error) {
        throw new Error('Failed to delete note')
    }

    // Sync deletion to GHL
    try {
        if (note?.client?.ghl_contact_id && note?.ghl_note_id) {
            const { GHLClient } = await import('@/lib/ghl/client')
            const ghl = new GHLClient()
            await ghl.deleteNote(note.client.ghl_contact_id, note.ghl_note_id)
        }
    } catch (syncError) {
        console.error('Failed to delete note from GHL:', syncError)
    }

    revalidatePath(`/dashboard/clients/${clientId}`)
}

export async function updateNote(noteId: string, clientId: string, content: string) {
    const supabase = await createClient()

    // Get note first for GHL info
    const { data: note } = await supabase
        .from('client_notes')
        .select(`
            *,
            client:clients(ghl_contact_id)
        `)
        .eq('id', noteId)
        .single()

    const { error } = await supabase
        .from('client_notes')
        .update({ content })
        .eq('id', noteId)

    if (error) {
        throw new Error('Failed to update note')
    }

    // Sync update to GHL
    try {
        if (note?.client?.ghl_contact_id && note?.ghl_note_id) {
            const { GHLClient } = await import('@/lib/ghl/client')
            const ghl = new GHLClient()
            await ghl.updateNote(note.client.ghl_contact_id, note.ghl_note_id, content)
        }
    } catch (syncError) {
        console.error('Failed to update note in GHL:', syncError)
    }

    revalidatePath(`/dashboard/clients/${clientId}`)
}

export async function togglePinNote(noteId: string, clientId: string, currentStatus: boolean) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('client_notes')
        .update({ is_pinned: !currentStatus })
        .eq('id', noteId)

    if (error) {
        throw new Error('Failed to toggle pin')
    }

    revalidatePath(`/dashboard/clients/${clientId}`)
}
