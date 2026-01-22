'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { ClientTag, ClientTagAssignment } from '@/types/client'

// Get all tags
export async function getTags(): Promise<ClientTag[]> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('client_tags')
        .select('*')
        .order('name')

    if (error) {
        console.error('Error fetching tags:', error)
        return []
    }

    return data as ClientTag[]
}

// Get tags for a specific client
export async function getClientTags(clientId: string): Promise<ClientTagAssignment[]> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('client_tag_assignments')
        .select(`
            *,
            tag:client_tags(*)
        `)
        .eq('client_id', clientId)

    if (error) {
        console.error('Error fetching client tags:', error)
        return []
    }

    return data as ClientTagAssignment[]
}

// Get all clients with their tags (for list view)
export async function getClientsWithTags(): Promise<Map<string, ClientTag[]>> {
    const supabase = createAdminClient()

    const { data, error } = await supabase
        .from('client_tag_assignments')
        .select(`
            client_id,
            tag:client_tags(*)
        `)

    if (error) {
        console.error('Error fetching clients with tags:', error)
        return new Map()
    }

    const tagsMap = new Map<string, ClientTag[]>()
    data?.forEach((assignment: any) => {
        const existing = tagsMap.get(assignment.client_id) || []
        if (assignment.tag) {
            existing.push(assignment.tag)
        }
        tagsMap.set(assignment.client_id, existing)
    })

    return tagsMap
}

// Create a new tag
export async function createTag(name: string, color: string, description?: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { data, error } = await supabase
        .from('client_tags')
        .insert({
            name,
            color,
            description,
            created_by: user?.id
        })
        .select()
        .single()

    if (error) {
        console.error('Error creating tag:', error)
        return { error: error.message }
    }

    revalidatePath('/clients')
    return { success: true, tag: data }
}

// Update a tag
export async function updateTag(id: string, updates: Partial<ClientTag>) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('client_tags')
        .update({
            name: updates.name,
            color: updates.color,
            description: updates.description
        })
        .eq('id', id)

    if (error) {
        console.error('Error updating tag:', error)
        return { error: error.message }
    }

    revalidatePath('/clients')
    return { success: true }
}

// Delete a tag
export async function deleteTag(id: string) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('client_tags')
        .delete()
        .eq('id', id)

    if (error) {
        console.error('Error deleting tag:', error)
        return { error: error.message }
    }

    revalidatePath('/clients')
    return { success: true }
}

// Assign a tag to a client
export async function assignTagToClient(clientId: string, tagId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase
        .from('client_tag_assignments')
        .insert({
            client_id: clientId,
            tag_id: tagId,
            assigned_by: user?.id
        })

    if (error) {
        // Ignore duplicate key errors (tag already assigned)
        if (error.code === '23505') {
            return { success: true, alreadyAssigned: true }
        }
        console.error('Error assigning tag:', error)
        return { error: error.message }
    }

    revalidatePath('/clients')
    revalidatePath(`/clients/${clientId}`)
    return { success: true }
}

// Remove a tag from a client
export async function removeTagFromClient(clientId: string, tagId: string) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('client_tag_assignments')
        .delete()
        .eq('client_id', clientId)
        .eq('tag_id', tagId)

    if (error) {
        console.error('Error removing tag:', error)
        return { error: error.message }
    }

    revalidatePath('/clients')
    revalidatePath(`/clients/${clientId}`)
    return { success: true }
}

// Bulk assign tag to multiple clients
export async function bulkAssignTag(clientIds: string[], tagId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const assignments = clientIds.map(clientId => ({
        client_id: clientId,
        tag_id: tagId,
        assigned_by: user?.id
    }))

    const { error } = await supabase
        .from('client_tag_assignments')
        .upsert(assignments, { onConflict: 'client_id,tag_id' })

    if (error) {
        console.error('Error bulk assigning tag:', error)
        return { error: error.message }
    }

    revalidatePath('/clients')
    return { success: true, assigned: clientIds.length }
}

// Bulk remove tag from multiple clients
export async function bulkRemoveTag(clientIds: string[], tagId: string) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('client_tag_assignments')
        .delete()
        .in('client_id', clientIds)
        .eq('tag_id', tagId)

    if (error) {
        console.error('Error bulk removing tag:', error)
        return { error: error.message }
    }

    revalidatePath('/clients')
    return { success: true, removed: clientIds.length }
}
