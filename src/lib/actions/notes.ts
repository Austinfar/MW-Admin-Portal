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
      author:users(name, email, id)
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

    const { error } = await supabase
        .from('client_notes')
        .insert({
            client_id: clientId,
            content,
            author_id: user.id,
        })

    if (error) {
        throw new Error('Failed to create note')
    }

    revalidatePath(`/dashboard/clients/${clientId}`)
}

export async function deleteNote(noteId: string, clientId: string) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('client_notes')
        .delete()
        .eq('id', noteId)

    if (error) {
        throw new Error('Failed to delete note')
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
