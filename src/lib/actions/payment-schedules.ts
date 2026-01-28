'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import type {
    ScheduledCharge,
    PaymentScheduleWithClientInfo,
} from '@/types/subscription';

// ============================================
// HELPER FUNCTIONS
// ============================================

async function getCurrentUser() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');
    return user;
}

async function getUserProfile(userId: string) {
    const supabase = createAdminClient();
    const { data } = await supabase
        .from('users')
        .select('id, name, email, role, job_title, permissions')
        .eq('id', userId)
        .single();
    return data;
}

async function isAdminUser(userId: string): Promise<boolean> {
    const profile = await getUserProfile(userId);
    return profile?.role === 'admin' || profile?.role === 'super_admin';
}

// ============================================
// PAYMENT SCHEDULE QUERIES
// ============================================

export interface PaymentScheduleFilters {
    status?: string[];
    hasWarning?: boolean;
}

/**
 * Get all payment schedules with client info for admin management
 */
export async function getAllPaymentSchedules(
    filters?: PaymentScheduleFilters
): Promise<PaymentScheduleWithClientInfo[]> {
    try {
        const user = await getCurrentUser();
        const isAdmin = await isAdminUser(user.id);

        if (!isAdmin) {
            console.error('[getAllPaymentSchedules] Permission denied for user:', user.id);
            return [];
        }

        const supabase = createAdminClient();

        let query = supabase
            .from('payment_schedules')
            .select(`
                *,
                scheduled_charges(*),
                client:clients(
                    id,
                    name,
                    email,
                    status
                )
            `)
            .order('created_at', { ascending: false });

        // Apply status filter if provided
        if (filters?.status && filters.status.length > 0) {
            query = query.in('status', filters.status);
        }

        const { data, error } = await query;

        if (error) {
            console.error('[getAllPaymentSchedules] Error:', error);
            return [];
        }

        // Map to extended type with warning flags
        const schedules = (data || []).map((schedule): PaymentScheduleWithClientInfo => {
            const pendingCharges = (schedule.scheduled_charges as ScheduledCharge[] || [])
                .filter(c => c.status === 'pending');

            const clientStatus = schedule.client?.status;
            const hasClientWarning = Boolean(
                schedule.client &&
                ['inactive', 'lost'].includes(clientStatus || '') &&
                pendingCharges.length > 0
            );

            return {
                ...schedule,
                scheduled_charges: schedule.scheduled_charges || [],
                client: schedule.client || null,
                pendingChargesCount: pendingCharges.length,
                hasClientWarning,
            };
        });

        // Filter by warning if requested
        if (filters?.hasWarning === true) {
            return schedules.filter(s => s.hasClientWarning);
        }

        return schedules;
    } catch (error) {
        console.error('[getAllPaymentSchedules] Error:', error);
        return [];
    }
}

/**
 * Get a single payment schedule by ID with all charges
 */
export async function getPaymentScheduleById(
    scheduleId: string
): Promise<PaymentScheduleWithClientInfo | null> {
    try {
        const user = await getCurrentUser();
        const isAdmin = await isAdminUser(user.id);

        if (!isAdmin) {
            console.error('[getPaymentScheduleById] Permission denied for user:', user.id);
            return null;
        }

        const supabase = createAdminClient();

        const { data, error } = await supabase
            .from('payment_schedules')
            .select(`
                *,
                scheduled_charges(*),
                client:clients(
                    id,
                    name,
                    email,
                    status
                )
            `)
            .eq('id', scheduleId)
            .single();

        if (error) {
            console.error('[getPaymentScheduleById] Error:', error);
            return null;
        }

        const pendingCharges = (data.scheduled_charges as ScheduledCharge[] || [])
            .filter(c => c.status === 'pending');

        const clientStatus = data.client?.status;
        const hasClientWarning = Boolean(
            data.client &&
            ['inactive', 'lost'].includes(clientStatus || '') &&
            pendingCharges.length > 0
        );

        return {
            ...data,
            scheduled_charges: data.scheduled_charges || [],
            client: data.client || null,
            pendingChargesCount: pendingCharges.length,
            hasClientWarning,
        };
    } catch (error) {
        console.error('[getPaymentScheduleById] Error:', error);
        return null;
    }
}

// ============================================
// PAYMENT SCHEDULE MUTATIONS
// ============================================

/**
 * Cancel an individual scheduled charge
 */
export async function cancelScheduledCharge(
    chargeId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const user = await getCurrentUser();
        const isAdmin = await isAdminUser(user.id);

        console.log('[cancelScheduledCharge] User:', user.id, 'isAdmin:', isAdmin, 'chargeId:', chargeId);

        if (!isAdmin) {
            return { success: false, error: 'Permission denied. Admin access required.' };
        }

        const supabase = createAdminClient();

        // Verify charge exists and is pending
        const { data: charge, error: fetchError } = await supabase
            .from('scheduled_charges')
            .select('*, schedule:payment_schedules(client_id, id)')
            .eq('id', chargeId)
            .single();

        console.log('[cancelScheduledCharge] Fetched charge:', charge, 'error:', fetchError);

        if (fetchError || !charge) {
            console.error('[cancelScheduledCharge] Charge not found. Error:', fetchError);
            return { success: false, error: `Charge not found: ${fetchError?.message || 'unknown error'}` };
        }

        if (charge.status !== 'pending') {
            return { success: false, error: `Can only cancel pending charges. Current status: ${charge.status}` };
        }

        // Update status to canceled
        // Note: Using "canceled" (American spelling) to match database enum
        const { error } = await supabase
            .from('scheduled_charges')
            .update({ status: 'canceled' })
            .eq('id', chargeId);

        console.log('[cancelScheduledCharge] Update result error:', error);

        if (error) {
            console.error('[cancelScheduledCharge] Update failed:', error);
            return { success: false, error: `Failed to cancel charge: ${error.message}` };
        }

        // Recalculate remaining amount on schedule
        const { data: allCharges } = await supabase
            .from('scheduled_charges')
            .select('amount, status')
            .eq('schedule_id', charge.schedule_id);

        const pendingTotal = (allCharges || [])
            .filter(c => c.status === 'pending')
            .reduce((sum, c) => sum + c.amount, 0);

        await supabase
            .from('payment_schedules')
            .update({ remaining_amount: pendingTotal })
            .eq('id', charge.schedule_id);

        // Revalidate paths
        revalidatePath('/admin/payment-schedules');
        const clientId = (charge.schedule as { client_id?: string })?.client_id;
        if (clientId) {
            revalidatePath(`/clients/${clientId}`);
        }

        return { success: true };
    } catch (error: unknown) {
        console.error('[cancelScheduledCharge] Error:', error);
        const message = error instanceof Error ? error.message : 'Failed to cancel charge';
        return { success: false, error: message };
    }
}

/**
 * Cancel an entire payment schedule (does NOT cancel individual charges per user preference)
 */
export async function cancelPaymentSchedule(
    scheduleId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const user = await getCurrentUser();
        const isAdmin = await isAdminUser(user.id);

        console.log('[cancelPaymentSchedule] User:', user.id, 'isAdmin:', isAdmin, 'scheduleId:', scheduleId);

        if (!isAdmin) {
            return { success: false, error: 'Permission denied. Admin access required.' };
        }

        const supabase = createAdminClient();

        // Get schedule to find client_id for revalidation
        const { data: schedule, error: fetchError } = await supabase
            .from('payment_schedules')
            .select('client_id, status')
            .eq('id', scheduleId)
            .single();

        console.log('[cancelPaymentSchedule] Fetched schedule:', schedule, 'error:', fetchError);

        if (fetchError || !schedule) {
            console.error('[cancelPaymentSchedule] Schedule not found. Error:', fetchError);
            return { success: false, error: `Schedule not found: ${fetchError?.message || 'unknown error'}` };
        }

        if (schedule.status === 'canceled' || schedule.status === 'cancelled') {
            return { success: false, error: 'Schedule is already canceled' };
        }

        if (schedule.status === 'completed') {
            return { success: false, error: 'Cannot cancel a completed schedule' };
        }

        // Update schedule status to canceled
        // Note: Using "canceled" (American spelling) to match database enum
        const { error } = await supabase
            .from('payment_schedules')
            .update({ status: 'canceled' })
            .eq('id', scheduleId);

        console.log('[cancelPaymentSchedule] Update result error:', error);

        if (error) {
            console.error('[cancelPaymentSchedule] Update failed:', error);
            return { success: false, error: `Failed to cancel schedule: ${error.message}` };
        }

        // Also cancel all pending charges to prevent the cron job from processing them
        // This is critical for safety - the cron only checks scheduled_charges.status, not payment_schedules.status
        const { error: chargesError, count } = await supabase
            .from('scheduled_charges')
            .update({ status: 'canceled' })
            .eq('schedule_id', scheduleId)
            .eq('status', 'pending');

        if (chargesError) {
            console.error('[cancelPaymentSchedule] Failed to cancel charges:', chargesError);
            // Don't fail the whole operation - schedule is already canceled
            // But log the warning
        } else {
            console.log(`[cancelPaymentSchedule] Canceled ${count ?? 0} pending charges`);
        }

        // Revalidate paths
        revalidatePath('/admin/payment-schedules');
        if (schedule.client_id) {
            revalidatePath(`/clients/${schedule.client_id}`);
        }

        return { success: true };
    } catch (error: unknown) {
        console.error('[cancelPaymentSchedule] Error:', error);
        const message = error instanceof Error ? error.message : 'Failed to cancel schedule';
        return { success: false, error: message };
    }
}

/**
 * Update a scheduled charge (date and/or amount)
 * Re-exported from subscriptions.ts for convenience, but with admin-only check
 */
export async function updateScheduledCharge(
    chargeId: string,
    updates: { amount?: number; due_date?: string }
): Promise<{ success: boolean; error?: string }> {
    try {
        const user = await getCurrentUser();
        const isAdmin = await isAdminUser(user.id);

        if (!isAdmin) {
            return { success: false, error: 'Permission denied. Admin access required.' };
        }

        const supabase = createAdminClient();

        // Get the charge to verify it's pending
        const { data: charge, error: fetchError } = await supabase
            .from('scheduled_charges')
            .select('*, schedule:payment_schedules(client_id)')
            .eq('id', chargeId)
            .single();

        if (fetchError || !charge) {
            return { success: false, error: 'Charge not found' };
        }

        if (charge.status !== 'pending') {
            return { success: false, error: 'Can only edit pending charges' };
        }

        // Validate amount if provided
        if (updates.amount !== undefined && updates.amount <= 0) {
            return { success: false, error: 'Amount must be greater than 0' };
        }

        // Update the charge
        const { error } = await supabase
            .from('scheduled_charges')
            .update({
                amount: updates.amount ?? charge.amount,
                due_date: updates.due_date ?? charge.due_date,
            })
            .eq('id', chargeId);

        if (error) {
            return { success: false, error: 'Failed to update charge' };
        }

        // Recalculate remaining amount on schedule if amount changed
        if (updates.amount && updates.amount !== charge.amount) {
            const { data: allCharges } = await supabase
                .from('scheduled_charges')
                .select('amount, status')
                .eq('schedule_id', charge.schedule_id);

            const pendingTotal = (allCharges || [])
                .filter(c => c.status === 'pending')
                .reduce((sum, c) => sum + c.amount, 0);

            await supabase
                .from('payment_schedules')
                .update({ remaining_amount: pendingTotal })
                .eq('id', charge.schedule_id);
        }

        // Revalidate paths
        revalidatePath('/admin/payment-schedules');
        const clientId = (charge.schedule as { client_id?: string })?.client_id;
        if (clientId) {
            revalidatePath(`/clients/${clientId}`);
        }

        return { success: true };
    } catch (error: unknown) {
        console.error('[updateScheduledCharge] Error:', error);
        const message = error instanceof Error ? error.message : 'Failed to update charge';
        return { success: false, error: message };
    }
}
