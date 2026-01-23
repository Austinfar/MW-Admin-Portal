'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getCurrentPayPeriod } from '@/lib/logic/commissions';

export interface ManualCommissionPayload {
    coachId: string;
    clientId?: string;
    clientName?: string; // For display when no client selected
    grossAmount: number;
    commissionAmount: number;
    date?: string; // ISO date string
    category: 'sale' | 'renewal' | 'referral' | 'bonus' | 'adjustment' | 'other';
    notes: string;
    role?: 'coach' | 'closer' | 'setter' | 'referrer';
}

export interface ManualCommissionResult {
    success: boolean;
    entryId?: string;
    error?: string;
}

/**
 * Check if the current user has permission to create manual commissions
 */
export async function canCreateManualCommissions(): Promise<boolean> {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data: profile } = await supabase
        .from('users')
        .select('role, permissions')
        .eq('id', user.id)
        .single();

    if (!profile) return false;

    // Super admins can always create manual commissions
    if (profile.role === 'super_admin') return true;

    // Check for specific permission
    const permissions = profile.permissions as Record<string, boolean> | null;
    return permissions?.can_create_manual_commissions === true;
}

/**
 * Create a manual commission entry
 */
export async function createManualCommission(
    payload: ManualCommissionPayload
): Promise<ManualCommissionResult> {
    // Verify permission
    const hasPermission = await canCreateManualCommissions();
    if (!hasPermission) {
        return { success: false, error: 'You do not have permission to create manual commissions' };
    }

    const supabase = createAdminClient();

    // Get current user for audit trail
    const clientSupabase = await createClient();
    const { data: { user } } = await clientSupabase.auth.getUser();
    if (!user) {
        return { success: false, error: 'Not authenticated' };
    }

    try {
        // Validate coach exists
        const { data: coach, error: coachError } = await supabase
            .from('users')
            .select('id, name')
            .eq('id', payload.coachId)
            .single();

        if (coachError || !coach) {
            return { success: false, error: 'Coach not found' };
        }

        // Validate client if provided
        let clientId = payload.clientId || null;
        if (clientId) {
            const { data: client, error: clientError } = await supabase
                .from('clients')
                .select('id')
                .eq('id', clientId)
                .single();

            if (clientError || !client) {
                return { success: false, error: 'Client not found' };
            }
        }

        // Get entry date
        const entryDate = payload.date ? new Date(payload.date) : new Date();

        // Determine if this should be a ledger entry (Sale/Renewal) or an adjustment (Bonus/etc)
        const isAdjustment = ['bonus', 'referral', 'adjustment', 'other'].includes(payload.category);

        if (isAdjustment) {
            // Map category to adjustment type
            let adjustmentType: 'bonus' | 'deduction' | 'correction' | 'chargeback' | 'referral' = 'bonus';

            if (payload.category === 'referral') {
                adjustmentType = 'referral';
            } else if (payload.category === 'adjustment') {
                // If negative, it's a deduction. If positive, a correction (or bonus).
                // Let's use correction for "adjustment".
                adjustmentType = payload.commissionAmount < 0 ? 'deduction' : 'correction';
            } else if (payload.category === 'other') {
                adjustmentType = 'bonus';
            }

            // Create adjustment entry
            const { data: entry, error: insertError } = await supabase
                .from('commission_adjustments')
                .insert({
                    user_id: payload.coachId,
                    amount: payload.commissionAmount,
                    adjustment_type: adjustmentType,
                    reason: payload.notes, // Use notes as the primary reason/description
                    notes: payload.category !== 'other' ? `Manual ${payload.category}` : undefined,
                    payroll_run_id: null, // Will be picked up by draft creation based on date
                    created_at: entryDate.toISOString(),
                    created_by: user.id,
                    is_visible_to_user: true
                })
                .select('id')
                .single();

            if (insertError) {
                console.error('Error creating manual adjustment:', insertError);
                return { success: false, error: insertError.message };
            }

            // Create notification
            await supabase
                .from('feature_notifications')
                .insert({
                    user_id: payload.coachId,
                    type: 'adjustment_added',
                    category: 'commission',
                    message: `Manual adjustment: ${payload.notes} ($${payload.commissionAmount.toFixed(2)})`,
                    amount: payload.commissionAmount,
                    is_read: false
                });

            return { success: true, entryId: entry.id };

        } else {
            // LEDGER ENTRY (Sale / Renewal)

            // Get period start for the entry date
            const { start: currentPeriodStart } = getCurrentPayPeriod();

            // Calculate period start for the entry date
            const anchor = new Date('2024-12-16T00:00:00Z');
            const diffTime = entryDate.getTime() - anchor.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            const periodIndex = Math.floor(diffDays / 14);
            const periodStart = new Date(anchor);
            periodStart.setDate(anchor.getDate() + (periodIndex * 14));
            const periodStartStr = periodStart.toISOString().split('T')[0];

            // Calculate rate for display
            const rate = payload.grossAmount > 0
                ? (payload.commissionAmount / payload.grossAmount)
                : 0;

            // Create ledger entry
            const { data: entry, error: insertError } = await supabase
                .from('commission_ledger')
                .insert({
                    user_id: payload.coachId,
                    client_id: clientId,
                    payment_id: null, // No payment for manual entries
                    gross_amount: payload.grossAmount,
                    net_amount: payload.grossAmount, // No fees for manual entries
                    commission_amount: payload.commissionAmount,
                    entry_type: 'manual',
                    split_role: payload.role || 'coach',
                    split_percentage: rate * 100,
                    source_schedule_id: null,
                    status: 'pending',
                    payout_period_start: periodStartStr,
                    calculation_basis: {
                        source: 'manual_entry',
                        category: payload.category,
                        notes: payload.notes,
                        client_name: payload.clientName || null,
                        created_by: user.id,
                        created_at: new Date().toISOString()
                    },
                    created_at: entryDate.toISOString()
                })
                .select('id')
                .single();

            if (insertError) {
                console.error('Error creating manual commission:', insertError);
                return { success: false, error: insertError.message };
            }

            // Create notification for the coach
            await supabase
                .from('feature_notifications')
                .insert({
                    user_id: payload.coachId,
                    type: 'commission_earned',
                    category: 'commission',
                    message: `Manual commission added: $${payload.commissionAmount.toFixed(2)} (${payload.category})`,
                    commission_ledger_id: entry.id,
                    amount: payload.commissionAmount,
                    is_read: false
                });

            return { success: true, entryId: entry.id };
        }
    } catch (err: any) {
        console.error('Error in createManualCommission:', err);
        return { success: false, error: err.message || 'Unknown error' };
    }
}

/**
 * Get coaches for the manual commission form
 */
export async function getCoachesForManualCommission(): Promise<Array<{
    id: string;
    name: string | null;
    email: string | null;
}>> {
    const supabase = createAdminClient();

    const { data: coaches, error } = await supabase
        .from('users')
        .select('id, name, email')
        .in('job_title', ['coach', 'head_coach', 'admin_staff', 'closer'])
        .eq('is_active', true)
        .order('name');

    if (error) {
        console.error('Error fetching coaches:', error);
        return [];
    }

    return coaches || [];
}

/**
 * Get clients for the manual commission form
 */
export async function getClientsForManualCommission(): Promise<Array<{
    id: string;
    name: string;
    email: string | null;
}>> {
    const supabase = createAdminClient();

    const { data: clients, error } = await supabase
        .from('clients')
        .select('id, name, email')
        .order('name');

    if (error) {
        console.error('Error fetching clients:', error);
        return [];
    }

    return clients || [];
}
