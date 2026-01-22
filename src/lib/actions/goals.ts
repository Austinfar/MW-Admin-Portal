'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { ClientGoal, GoalType, GoalStatus } from '@/types/client'

// Get all goals for a client
export async function getClientGoals(clientId: string): Promise<ClientGoal[]> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('client_goals')
        .select('*')
        .eq('client_id', clientId)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching client goals:', error)
        return []
    }

    return data as ClientGoal[]
}

// Get active goals for a client
export async function getActiveGoals(clientId: string): Promise<ClientGoal[]> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('client_goals')
        .select('*')
        .eq('client_id', clientId)
        .eq('status', 'active')
        .order('priority', { ascending: false })
        .order('target_date', { ascending: true })

    if (error) {
        console.error('Error fetching active goals:', error)
        return []
    }

    return data as ClientGoal[]
}

// Create a new goal
export async function createGoal(
    clientId: string,
    data: {
        title: string
        description?: string
        goal_type: GoalType
        target_value?: number
        target_unit?: string
        target_date?: string
        priority?: number
    }
) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { data: goal, error } = await supabase
        .from('client_goals')
        .insert({
            client_id: clientId,
            title: data.title,
            description: data.description,
            goal_type: data.goal_type,
            target_value: data.target_value,
            target_unit: data.target_unit,
            target_date: data.target_date,
            priority: data.priority || 0,
            created_by: user?.id
        })
        .select()
        .single()

    if (error) {
        console.error('Error creating goal:', error)
        return { error: error.message }
    }

    revalidatePath(`/clients/${clientId}`)
    return { success: true, goal }
}

// Update a goal
export async function updateGoal(
    goalId: string,
    updates: Partial<{
        title: string
        description: string
        target_value: number
        target_unit: string
        current_value: number
        target_date: string
        priority: number
        status: GoalStatus
    }>
) {
    const supabase = await createClient()

    // If status is being set to achieved, set achieved_at
    const updateData: any = { ...updates }
    if (updates.status === 'achieved' && !updateData.achieved_at) {
        updateData.achieved_at = new Date().toISOString()
    }

    const { data: goal, error } = await supabase
        .from('client_goals')
        .update(updateData)
        .eq('id', goalId)
        .select('client_id')
        .single()

    if (error) {
        console.error('Error updating goal:', error)
        return { error: error.message }
    }

    revalidatePath(`/clients/${goal.client_id}`)
    return { success: true }
}

// Update goal progress
export async function updateGoalProgress(goalId: string, currentValue: number) {
    const supabase = await createClient()

    // Get the goal to check if target is reached
    const { data: goal } = await supabase
        .from('client_goals')
        .select('target_value, client_id')
        .eq('id', goalId)
        .single()

    const updates: any = { current_value: currentValue }

    // Auto-achieve if target reached
    if (goal?.target_value && currentValue >= goal.target_value) {
        updates.status = 'achieved'
        updates.achieved_at = new Date().toISOString()
    }

    const { error } = await supabase
        .from('client_goals')
        .update(updates)
        .eq('id', goalId)

    if (error) {
        console.error('Error updating goal progress:', error)
        return { error: error.message }
    }

    if (goal?.client_id) {
        revalidatePath(`/clients/${goal.client_id}`)
    }
    return { success: true }
}

// Mark goal as achieved
export async function achieveGoal(goalId: string) {
    return updateGoal(goalId, {
        status: 'achieved',
    })
}

// Abandon a goal
export async function abandonGoal(goalId: string) {
    return updateGoal(goalId, {
        status: 'abandoned',
    })
}

// Reactivate a goal
export async function reactivateGoal(goalId: string) {
    const supabase = await createClient()

    const { data: goal, error } = await supabase
        .from('client_goals')
        .update({
            status: 'active',
            achieved_at: null
        })
        .eq('id', goalId)
        .select('client_id')
        .single()

    if (error) {
        console.error('Error reactivating goal:', error)
        return { error: error.message }
    }

    revalidatePath(`/clients/${goal.client_id}`)
    return { success: true }
}

// Delete a goal
export async function deleteGoal(goalId: string) {
    const supabase = await createClient()

    // Get client_id first for revalidation
    const { data: goal } = await supabase
        .from('client_goals')
        .select('client_id')
        .eq('id', goalId)
        .single()

    const { error } = await supabase
        .from('client_goals')
        .delete()
        .eq('id', goalId)

    if (error) {
        console.error('Error deleting goal:', error)
        return { error: error.message }
    }

    if (goal?.client_id) {
        revalidatePath(`/clients/${goal.client_id}`)
    }
    return { success: true }
}
