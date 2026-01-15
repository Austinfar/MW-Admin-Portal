'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createClientType(name: string, description: string | null) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('client_types')
        .insert({
            name,
            description,
            is_active: true
        })

    if (error) {
        return { error: error.message }
    }

    revalidatePath('/settings')
    return { success: true }
}

export async function toggleClientTypeStatus(id: string, currentStatus: boolean) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('client_types')
        .update({ is_active: !currentStatus })
        .eq('id', id)

    if (error) {
        return { error: error.message }
    }

    revalidatePath('/settings')
    return { success: true }
}

export async function deleteClientType(id: string) {
    const supabase = await createClient()

    // Soft delete or hard delete? Schema doesn't specify soft delete column other than is_active.
    // For now, let's stick to deactivating (toggle) vs hard delete to preserve history.
    // But if we truly want to delete:
    const { error } = await supabase
        .from('client_types')
        .delete()
        .eq('id', id)

    if (error) {
        return { error: error.message }
    }

    revalidatePath('/settings')
    return { success: true }
}

export async function getAllClientTypes() {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('client_types')
        .select('*')
        .order('created_at', { ascending: true })

    if (error) {
        console.error('Error fetching client types:', error)
        return []
    }

    return data
}
