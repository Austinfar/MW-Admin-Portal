'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { startOfDay, endOfDay, format } from 'date-fns';
import { revalidatePath } from 'next/cache';

// ============================================
// TYPES
// ============================================

export interface PayrollRun {
    id: string;
    period_start: string;
    period_end: string;
    payout_date: string;
    status: 'draft' | 'approved' | 'paid' | 'void';
    total_commission: number;
    total_adjustments: number;
    total_payout: number;
    transaction_count: number;
    created_by: string;
    created_at: string;
    approved_by?: string;
    approved_at?: string;
    paid_by?: string;
    paid_at?: string;
    voided_by?: string;
    voided_at?: string;
    void_reason?: string;
    notes?: string;
    // Joined data
    creator?: { name: string; email: string };
    approver?: { name: string; email: string };
    payer?: { name: string; email: string };
}

export interface CommissionAdjustment {
    id: string;
    payroll_run_id?: string;
    user_id: string;
    amount: number;
    adjustment_type: 'bonus' | 'deduction' | 'correction' | 'chargeback' | 'referral';
    reason: string;
    notes?: string;
    related_ledger_id?: string;
    related_payment_id?: string;
    created_by?: string;
    created_at: string;
    is_visible_to_user: boolean;
    // Joined data
    users?: { name: string; email: string };
    creator?: { name: string; email: string };
}

export interface PayrollLedgerEntry {
    id: string;
    created_at: string;
    user_id: string;
    client_id: string;
    payment_id: string;
    gross_amount: number;
    net_amount: number;
    commission_amount: number;
    status: 'pending' | 'paid' | 'void';
    payroll_run_id?: string;
    paid_at?: string;
    entry_type: 'commission' | 'split' | 'manual' | 'import';
    split_role?: string;
    split_percentage?: number;
    source_schedule_id?: string;
    payout_period_start?: string;
    transaction_date?: string;
    calculation_basis: Record<string, unknown>;
    // Joined data
    users?: { name: string; email: string };
    clients?: { name: string; start_date?: string; lead_source?: string };
}

export interface PayrollStats {
    entries: PayrollLedgerEntry[];
    totalCommission: number;
    totalAdjustments: number;
    totalPayout: number;
    totalVolume: number;
    transactionCount: number;
    summary: {
        byUser: Record<string, {
            name: string;
            email: string;
            commission: number;
            adjustments: number;
            total: number;
            deals: number;
        }>;
        topEarner: { name: string; amount: number };
    };
    run?: PayrollRun;
    adjustments: CommissionAdjustment[];
}

export type PayrollFilters = {
    coachId?: string;
    clientType?: string;
    searchQuery?: string;
    sortBy?: 'date' | 'amount' | 'client' | 'coach';
    sortOrder?: 'asc' | 'desc';
    payrollRunId?: string;
};

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
    // Use admin client to bypass RLS when checking user profile
    const supabase = createAdminClient();
    const { data } = await supabase
        .from('users')
        .select('id, name, email, role, permissions')
        .eq('id', userId)
        .single();
    return data;
}

async function checkPermission(userId: string, permission: string): Promise<boolean> {
    const profile = await getUserProfile(userId);
    if (!profile) return false;

    // Super admins have all permissions
    if (profile.role === 'super_admin') return true;

    // Check specific permission in JSONB
    const permissions = profile.permissions as Record<string, boolean> | null;
    return permissions?.[permission] === true;
}

async function isAdmin(userId: string): Promise<boolean> {
    const profile = await getUserProfile(userId);
    return profile?.role === 'admin' || profile?.role === 'super_admin';
}

// ============================================
// PAYROLL RUN MANAGEMENT
// ============================================

export async function getAllUsers() {
    // Use admin client to bypass RLS and get all users
    const supabase = createAdminClient();
    const { data } = await supabase.from('users').select('id, name, email').order('name');
    return data || [];
}

export async function getPayrollHistory(): Promise<PayrollRun[]> {
    const user = await getCurrentUser();
    const supabase = await createClient();

    // Check if admin
    const admin = await isAdmin(user.id);
    if (!admin) {
        // Non-admins can only see runs that contain their entries
        // First, get the payroll run IDs for this user
        const { data: ledgerEntries } = await supabase
            .from('commission_ledger')
            .select('payroll_run_id')
            .eq('user_id', user.id)
            .not('payroll_run_id', 'is', null);

        const runIds = [...new Set((ledgerEntries || []).map(e => e.payroll_run_id).filter(Boolean))];

        if (runIds.length === 0) {
            return [];
        }

        const { data } = await supabase
            .from('payroll_runs')
            .select(`
                *,
                creator:users!payroll_runs_created_by_fkey(name, email),
                approver:users!payroll_runs_approved_by_fkey(name, email),
                payer:users!payroll_runs_paid_by_fkey(name, email)
            `)
            .in('id', runIds)
            .order('period_end', { ascending: false });

        return (data || []) as PayrollRun[];
    }

    // For admins, use admin client to bypass RLS
    const adminSupabase = createAdminClient();
    const { data: runs, error } = await adminSupabase
        .from('payroll_runs')
        .select('*')
        .order('period_end', { ascending: false });

    if (error) {
        console.error('Error fetching payroll history:', error);
        return [];
    }

    // Manually fetch creator info for each run
    const enrichedRuns = await Promise.all((runs || []).map(async (run) => {
        let creator = null;
        let approver = null;
        let payer = null;

        if (run.created_by) {
            const { data } = await adminSupabase.from('users').select('name, email').eq('id', run.created_by).single();
            creator = data;
        }
        if (run.approved_by) {
            const { data } = await adminSupabase.from('users').select('name, email').eq('id', run.approved_by).single();
            approver = data;
        }
        if (run.paid_by) {
            const { data } = await adminSupabase.from('users').select('name, email').eq('id', run.paid_by).single();
            payer = data;
        }

        return { ...run, creator, approver, payer };
    }));

    return enrichedRuns as PayrollRun[];
}

export async function getPayrollRun(runId: string): Promise<PayrollRun | null> {
    const user = await getCurrentUser();
    const admin = await isAdmin(user.id);

    // Use admin client if user is admin to bypass RLS
    const supabase = admin ? createAdminClient() : await createClient();

    const { data: run, error } = await supabase
        .from('payroll_runs')
        .select('*')
        .eq('id', runId)
        .single();

    if (error) {
        console.error('Error fetching payroll run:', error);
        return null;
    }

    if (!run) return null;

    // Manually fetch user info
    const adminSupabase = createAdminClient();
    let creator = null;
    let approver = null;
    let payer = null;

    if (run.created_by) {
        const { data } = await adminSupabase.from('users').select('name, email').eq('id', run.created_by).single();
        creator = data;
    }
    if (run.approved_by) {
        const { data } = await adminSupabase.from('users').select('name, email').eq('id', run.approved_by).single();
        approver = data;
    }
    if (run.paid_by) {
        const { data } = await adminSupabase.from('users').select('name, email').eq('id', run.paid_by).single();
        payer = data;
    }

    return { ...run, creator, approver, payer } as PayrollRun;
}

/**
 * Create a new payroll draft and lock pending commission entries to it.
 * Only admins can create payroll drafts.
 */
export async function createPayrollDraft(
    periodStart: Date,
    periodEnd: Date,
    payoutDate: Date,
    notes?: string
): Promise<{ success: boolean; runId?: string; error?: string }> {
    const user = await getCurrentUser();

    // Check admin permission
    if (!await isAdmin(user.id)) {
        return { success: false, error: 'Only admins can create payroll drafts' };
    }

    // Use admin client to bypass RLS
    const supabase = createAdminClient();

    // Check for overlapping period
    const { data: existing } = await supabase
        .from('payroll_runs')
        .select('id')
        .lte('period_start', periodEnd.toISOString())
        .gte('period_end', periodStart.toISOString())
        .neq('status', 'void')
        .limit(1);

    if (existing && existing.length > 0) {
        return { success: false, error: 'A payroll run already exists for this period' };
    }

    // 1. Create the draft run
    const { data: run, error: runError } = await supabase
        .from('payroll_runs')
        .insert({
            period_start: format(periodStart, 'yyyy-MM-dd'),
            period_end: format(periodEnd, 'yyyy-MM-dd'),
            payout_date: format(payoutDate, 'yyyy-MM-dd'),
            status: 'draft',
            created_by: user.id,
            notes
        })
        .select()
        .single();

    if (runError) {
        console.error('Failed to create payroll run:', runError);
        return { success: false, error: `Failed to create run: ${runError.message}` };
    }

    // 2. Lock pending ledger entries to this run
    // Only entries with payout_period_start matching this period OR
    // entries created within the period that don't have a run yet
    const { error: updateError } = await supabase
        .from('commission_ledger')
        .update({ payroll_run_id: run.id })
        .eq('status', 'pending')
        .is('payroll_run_id', null)
        .lte('created_at', endOfDay(periodEnd).toISOString());

    if (updateError) {
        console.error('Failed to link ledger items:', updateError);
        // Rollback the run creation
        await supabase.from('payroll_runs').delete().eq('id', run.id);
        return { success: false, error: `Failed to link ledger items: ${updateError.message}` };
    }

    // 3. Link pending adjustments to this run
    await supabase
        .from('commission_adjustments')
        .update({ payroll_run_id: run.id })
        .is('payroll_run_id', null)
        .lte('created_at', endOfDay(periodEnd).toISOString());

    // 4. Calculate totals
    await recalculateRunTotals(run.id);

    revalidatePath('/commissions');
    return { success: true, runId: run.id };
}

/**
 * Approve a payroll run. Requires can_approve_payroll permission.
 * The approver must be a different user than the creator.
 */
export async function approvePayrollRun(runId: string): Promise<{ success: boolean; error?: string }> {
    const user = await getCurrentUser();

    // Check permission
    const canApprove = await checkPermission(user.id, 'can_approve_payroll');
    if (!canApprove) {
        return { success: false, error: 'You do not have permission to approve payroll runs' };
    }

    // Use admin client to bypass RLS
    const supabase = createAdminClient();

    // Fetch the run
    const { data: run, error: fetchError } = await supabase
        .from('payroll_runs')
        .select('*')
        .eq('id', runId)
        .single();

    if (fetchError || !run) {
        return { success: false, error: 'Payroll run not found' };
    }

    // Check status
    if (run.status !== 'draft') {
        return { success: false, error: `Cannot approve a run with status: ${run.status}` };
    }

    // Check two-person rule (enforced at DB level too, but check here for better UX)
    if (run.created_by === user.id) {
        return { success: false, error: 'You cannot approve a payroll run you created' };
    }

    // Update status
    const { error: updateError } = await supabase
        .from('payroll_runs')
        .update({
            status: 'approved',
            approved_by: user.id,
            approved_at: new Date().toISOString()
        })
        .eq('id', runId);

    if (updateError) {
        console.error('Failed to approve payroll run:', updateError);
        return { success: false, error: `Failed to approve: ${updateError.message}` };
    }

    // Create notifications for all users in this run
    await createPayrollNotifications(runId, 'payroll_approved', 'Payroll has been approved and is ready for payout');

    revalidatePath('/commissions');
    return { success: true };
}

/**
 * Mark a payroll run as paid. Only approved runs can be marked as paid.
 */
export async function markPayrollPaid(runId: string): Promise<{ success: boolean; error?: string }> {
    const user = await getCurrentUser();

    // Check admin permission
    if (!await isAdmin(user.id)) {
        return { success: false, error: 'Only admins can mark payroll as paid' };
    }

    // Use admin client to bypass RLS
    const supabase = createAdminClient();

    // Fetch the run
    const { data: run, error: fetchError } = await supabase
        .from('payroll_runs')
        .select('*')
        .eq('id', runId)
        .single();

    if (fetchError || !run) {
        return { success: false, error: 'Payroll run not found' };
    }

    // Check status
    if (run.status !== 'approved') {
        return { success: false, error: `Cannot mark as paid: run must be approved first (current status: ${run.status})` };
    }

    const paidAt = new Date().toISOString();

    // 1. Update run status
    const { error: runError } = await supabase
        .from('payroll_runs')
        .update({
            status: 'paid',
            paid_by: user.id,
            paid_at: paidAt
        })
        .eq('id', runId);

    if (runError) {
        return { success: false, error: `Failed to update run: ${runError.message}` };
    }

    // 2. Update all ledger entries
    const { error: ledgerError } = await supabase
        .from('commission_ledger')
        .update({
            status: 'paid',
            paid_at: paidAt
        })
        .eq('payroll_run_id', runId);

    if (ledgerError) {
        console.error('Failed to update ledger entries:', ledgerError);
    }

    // Create notifications
    await createPayrollNotifications(runId, 'payroll_paid', 'Your commission payout has been processed');

    revalidatePath('/commissions');
    return { success: true };
}

/**
 * Void a payroll run. Releases all entries back to pending.
 */
export async function voidPayrollRun(runId: string, reason: string): Promise<{ success: boolean; error?: string }> {
    const user = await getCurrentUser();

    // Check admin permission
    if (!await isAdmin(user.id)) {
        return { success: false, error: 'Only admins can void payroll runs' };
    }

    if (!reason || reason.trim().length < 10) {
        return { success: false, error: 'Please provide a reason for voiding (at least 10 characters)' };
    }

    // Use admin client to bypass RLS
    const supabase = createAdminClient();

    // Fetch the run
    const { data: run, error: fetchError } = await supabase
        .from('payroll_runs')
        .select('*')
        .eq('id', runId)
        .single();

    if (fetchError || !run) {
        return { success: false, error: 'Payroll run not found' };
    }

    // Cannot void a paid run
    if (run.status === 'paid') {
        return { success: false, error: 'Cannot void a run that has already been paid' };
    }

    if (run.status === 'void') {
        return { success: false, error: 'Run is already voided' };
    }

    // 1. Update run status
    const { error: runError } = await supabase
        .from('payroll_runs')
        .update({
            status: 'void',
            voided_by: user.id,
            voided_at: new Date().toISOString(),
            void_reason: reason
        })
        .eq('id', runId);

    if (runError) {
        return { success: false, error: `Failed to void run: ${runError.message}` };
    }

    // 2. Release ledger entries back to pending (remove run link)
    await supabase
        .from('commission_ledger')
        .update({
            payroll_run_id: null,
            status: 'pending'
        })
        .eq('payroll_run_id', runId);

    // 3. Release adjustments
    await supabase
        .from('commission_adjustments')
        .update({ payroll_run_id: null })
        .eq('payroll_run_id', runId);

    revalidatePath('/commissions');
    return { success: true };
}

/**
 * Recalculate totals for a payroll run.
 */
async function recalculateRunTotals(runId: string): Promise<void> {
    const supabase = createAdminClient();

    // Get commission total
    const { data: ledgerEntries } = await supabase
        .from('commission_ledger')
        .select('commission_amount')
        .eq('payroll_run_id', runId);

    const totalCommission = (ledgerEntries || []).reduce(
        (sum, e) => sum + Number(e.commission_amount),
        0
    );

    // Get adjustment total
    const { data: adjustments } = await supabase
        .from('commission_adjustments')
        .select('amount')
        .eq('payroll_run_id', runId);

    const totalAdjustments = (adjustments || []).reduce(
        (sum, a) => sum + Number(a.amount),
        0
    );

    const transactionCount = (ledgerEntries?.length || 0) + (adjustments?.length || 0);

    // Update run
    await supabase
        .from('payroll_runs')
        .update({
            total_commission: totalCommission,
            total_adjustments: totalAdjustments,
            total_payout: totalCommission + totalAdjustments,
            transaction_count: transactionCount
        })
        .eq('id', runId);
}

// ============================================
// ADJUSTMENTS
// ============================================

/**
 * Add a manual adjustment (bonus, deduction, correction).
 */
export async function addAdjustment(
    userId: string,
    amount: number,
    adjustmentType: CommissionAdjustment['adjustment_type'],
    reason: string,
    options?: {
        runId?: string;
        notes?: string;
        relatedLedgerId?: string;
        relatedPaymentId?: string;
        isVisibleToUser?: boolean;
    }
): Promise<{ success: boolean; adjustmentId?: string; error?: string }> {
    const user = await getCurrentUser();

    // Check permission
    const canCreate = await checkPermission(user.id, 'can_create_manual_commissions') || await isAdmin(user.id);
    if (!canCreate) {
        return { success: false, error: 'You do not have permission to create adjustments' };
    }

    if (!reason || reason.trim().length < 5) {
        return { success: false, error: 'Please provide a reason (at least 5 characters)' };
    }

    // Use admin client to bypass RLS
    const supabase = createAdminClient();

    // Validate the target user exists
    const { data: targetUser } = await supabase
        .from('users')
        .select('id')
        .eq('id', userId)
        .single();

    if (!targetUser) {
        return { success: false, error: 'Target user not found' };
    }

    // If a run is specified, verify it's in draft status
    if (options?.runId) {
        const { data: run } = await supabase
            .from('payroll_runs')
            .select('status')
            .eq('id', options.runId)
            .single();

        if (run && run.status !== 'draft') {
            return { success: false, error: 'Cannot add adjustments to a run that is not in draft status' };
        }
    }

    const { data: adjustment, error } = await supabase
        .from('commission_adjustments')
        .insert({
            user_id: userId,
            amount,
            adjustment_type: adjustmentType,
            reason,
            notes: options?.notes,
            payroll_run_id: options?.runId,
            related_ledger_id: options?.relatedLedgerId,
            related_payment_id: options?.relatedPaymentId,
            created_by: user.id,
            is_visible_to_user: options?.isVisibleToUser ?? true
        })
        .select()
        .single();

    if (error) {
        console.error('Failed to create adjustment:', error);
        return { success: false, error: `Failed to create adjustment: ${error.message}` };
    }

    // Recalculate run totals if linked to a run
    if (options?.runId) {
        await recalculateRunTotals(options.runId);
    }

    // Create notification for the user
    if (options?.isVisibleToUser !== false) {
        const supabaseAdmin = createAdminClient();
        const amountStr = amount >= 0 ? `+$${amount.toFixed(2)}` : `-$${Math.abs(amount).toFixed(2)}`;
        await supabaseAdmin.from('feature_notifications').insert({
            user_id: userId,
            type: 'adjustment_added',
            category: 'commission',
            message: `Adjustment: ${reason} (${amountStr})`,
            amount,
            is_read: false
        });
    }

    revalidatePath('/commissions');
    return { success: true, adjustmentId: adjustment.id };
}

/**
 * Remove an adjustment. Only possible for draft runs.
 */
export async function removeAdjustment(adjustmentId: string): Promise<{ success: boolean; error?: string }> {
    const user = await getCurrentUser();

    // Check permission
    if (!await isAdmin(user.id)) {
        return { success: false, error: 'Only admins can remove adjustments' };
    }

    // Use admin client to bypass RLS
    const supabase = createAdminClient();

    // Fetch the adjustment
    const { data: adjustment } = await supabase
        .from('commission_adjustments')
        .select('*, payroll_runs:payroll_run_id(status)')
        .eq('id', adjustmentId)
        .single();

    if (!adjustment) {
        return { success: false, error: 'Adjustment not found' };
    }

    // Check if linked to a non-draft run
    if (adjustment.payroll_runs && (adjustment.payroll_runs as any).status !== 'draft') {
        return { success: false, error: 'Cannot remove adjustment from a finalized payroll run' };
    }

    const runId = adjustment.payroll_run_id;

    const { error } = await supabase
        .from('commission_adjustments')
        .delete()
        .eq('id', adjustmentId);

    if (error) {
        return { success: false, error: `Failed to remove adjustment: ${error.message}` };
    }

    // Recalculate run totals
    if (runId) {
        await recalculateRunTotals(runId);
    }

    revalidatePath('/commissions');
    return { success: true };
}

/**
 * Get adjustments for a user or run.
 */
export async function getAdjustments(options: {
    userId?: string;
    runId?: string;
    includeHidden?: boolean;
    startDate?: Date;
    endDate?: Date;
}): Promise<CommissionAdjustment[]> {
    const user = await getCurrentUser();
    const admin = await isAdmin(user.id);

    // Use admin client for admins to bypass RLS
    const supabase = admin ? createAdminClient() : await createClient();

    let query = supabase
        .from('commission_adjustments')
        .select(`
            *,
            users:user_id(name, email),
            creator:created_by(name, email)
        `)
        .order('created_at', { ascending: false });

    if (options.runId) {
        query = query.eq('payroll_run_id', options.runId);
    }

    // Filter by date range if provided (and not filtering by run)
    if (!options.runId && options.startDate && options.endDate) {
        query = query
            .gte('created_at', startOfDay(options.startDate).toISOString())
            .lte('created_at', endOfDay(options.endDate).toISOString());
    }

    if (options.userId) {
        query = query.eq('user_id', options.userId);
    } else if (!admin) {
        // Non-admins only see their own adjustments
        query = query.eq('user_id', user.id);
    }

    // Hide invisible adjustments for non-admins
    if (!admin && !options.includeHidden) {
        query = query.eq('is_visible_to_user', true);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching adjustments:', error);
        return [];
    }

    return (data || []) as CommissionAdjustment[];
}

// ============================================
// PAYROLL STATS
// ============================================

export async function getPayrollStats(startDate: Date, endDate: Date, filters?: PayrollFilters): Promise<PayrollStats> {
    const user = await getCurrentUser();
    const admin = await isAdmin(user.id);

    // Use admin client for admins to bypass RLS
    const supabase = admin ? createAdminClient() : await createClient();

    // Build ledger query
    let query = supabase
        .from('commission_ledger')
        .select(`
            *,
            users:user_id(name, email),
            clients:client_id(name, lead_source, start_date)
        `)
        .neq('status', 'void');

    // Filter by run or date range
    if (filters?.payrollRunId) {
        query = query.eq('payroll_run_id', filters.payrollRunId);
    } else {
        // Filter by transaction_date for accurate period reporting
        // Also filter by payout_period_start to ensure we capture items belonging to this period logic
        query = query
            .gte('transaction_date', startOfDay(startDate).toISOString())
            .lte('transaction_date', endOfDay(endDate).toISOString());

        // We can't strictly filter by payout_period_start because it's a string YYYY-MM-DD
        // and we want to capture everything in the date range.
        // transaction_date is the source of truth for "when it happened".
    }

    // Apply filters
    if (filters?.coachId && admin) {
        query = query.eq('user_id', filters.coachId);
    }

    if (filters?.clientType) {
        query = query.eq('clients.lead_source', filters.clientType);
    }

    // Sort
    const sortOrder = filters?.sortOrder === 'asc';
    switch (filters?.sortBy) {
        case 'amount':
            query = query.order('commission_amount', { ascending: sortOrder });
            break;
        case 'date':
        default:
            query = query.order('transaction_date', { ascending: sortOrder, nullsFirst: false })
                .order('created_at', { ascending: sortOrder });
    }

    // Restrict non-admins to their own entries
    if (!admin) {
        query = query.eq('user_id', user.id);
    }

    const { data: commissions, error } = await query;

    if (error) {
        console.error('Error fetching payroll stats:', error);
        throw new Error(`Failed to fetch payroll stats: ${error.message}`);
    }

    // Filter by search query in memory
    let filteredCommissions = commissions || [];
    if (filters?.searchQuery) {
        const q = filters.searchQuery.toLowerCase();
        filteredCommissions = filteredCommissions.filter(c =>
            (c.users?.name?.toLowerCase() || '').includes(q) ||
            (c.clients?.name?.toLowerCase() || '').includes(q) ||
            (c.users?.email?.toLowerCase() || '').includes(q)
        );
    }

    // Fetch adjustments
    let adjustments: CommissionAdjustment[] = [];
    if (filters?.payrollRunId) {
        adjustments = await getAdjustments({ runId: filters.payrollRunId });
    } else {
        adjustments = await getAdjustments({
            startDate,
            endDate
        });

        // Manual filtering for coachId since getAdjustments helper logic is a bit complex 
        // regarding admin vs user view. 
        // If filters.coachId is present, we should filter the results.
        if (filters?.coachId && admin) {
            adjustments = adjustments.filter(a => a.user_id === filters.coachId);
        }
    }

    // Fetch run if specified
    let run: PayrollRun | undefined;
    if (filters?.payrollRunId) {
        run = (await getPayrollRun(filters.payrollRunId)) || undefined;
    }

    // Calculate summary
    const byUser: PayrollStats['summary']['byUser'] = {};

    // Process commission entries
    filteredCommissions.forEach(entry => {
        const userId = entry.user_id;
        const userName = entry.users?.name || 'Unknown';
        const userEmail = entry.users?.email || '';
        const amount = Number(entry.commission_amount);

        if (!byUser[userId]) {
            byUser[userId] = { name: userName, email: userEmail, commission: 0, adjustments: 0, total: 0, deals: 0 };
        }

        byUser[userId].commission += amount;
        byUser[userId].total += amount;
        byUser[userId].deals += 1;
    });

    // Process adjustments
    adjustments.forEach(adj => {
        const userId = adj.user_id;
        const userName = adj.users?.name || 'Unknown';
        const userEmail = adj.users?.email || '';
        const amount = Number(adj.amount);

        if (!byUser[userId]) {
            byUser[userId] = { name: userName, email: userEmail, commission: 0, adjustments: 0, total: 0, deals: 0 };
        }

        byUser[userId].adjustments += amount;
        byUser[userId].total += amount;
    });

    // Find top earner
    let topEarner = { name: 'N/A', amount: 0 };
    Object.values(byUser).forEach(u => {
        if (u.total > topEarner.amount) {
            topEarner = { name: u.name, amount: u.total };
        }
    });

    // Calculate totals
    const totalCommission = Object.values(byUser).reduce((sum, u) => sum + u.commission, 0);
    const totalAdjustments = Object.values(byUser).reduce((sum, u) => sum + u.adjustments, 0);
    const totalVolume = filteredCommissions.reduce((sum, c) => sum + Number(c.net_amount), 0);

    return {
        entries: filteredCommissions as PayrollLedgerEntry[],
        adjustments,
        totalCommission,
        totalAdjustments,
        totalPayout: totalCommission + totalAdjustments,
        totalVolume,
        transactionCount: filteredCommissions.length,
        summary: { byUser, topEarner },
        run
    };
}

// ============================================
// EXPORTS
// ============================================

/**
 * Generate a summary CSV export (one row per user).
 */
export async function generateSummaryExport(runId: string): Promise<string> {
    const stats = await getPayrollStats(new Date(), new Date(), { payrollRunId: runId });
    const run = stats.run;

    const header = [
        'Coach Name',
        'Email',
        'Commission Earned',
        'Adjustments',
        'Total Payout',
        'Deals',
        'Period Start',
        'Period End',
        'Payout Date'
    ].join(',');

    const rows = Object.entries(stats.summary.byUser).map(([_userId, user]) => {
        return [
            `"${user.name.replace(/"/g, '""')}"`,
            user.email,
            user.commission.toFixed(2),
            user.adjustments.toFixed(2),
            user.total.toFixed(2),
            user.deals,
            run?.period_start || '',
            run?.period_end || '',
            run?.payout_date || ''
        ].join(',');
    });

    // Add totals row
    rows.push([
        '"TOTAL"',
        '',
        stats.totalCommission.toFixed(2),
        stats.totalAdjustments.toFixed(2),
        stats.totalPayout.toFixed(2),
        stats.transactionCount,
        '',
        '',
        ''
    ].join(','));

    return [header, ...rows].join('\n');
}

/**
 * Generate a detailed CSV export (one row per transaction).
 */
export async function generateDetailedExport(runId: string): Promise<string> {
    const stats = await getPayrollStats(new Date(), new Date(), { payrollRunId: runId });

    const header = [
        'Date',
        'Type',
        'Recipient',
        'Email',
        'Client',
        'Lead Source',
        'Role',
        'Gross Amount',
        'Stripe Fee',
        'Basis Amount',
        'Basis Type',
        'Rate',
        'Commission',
        'Status'
    ].join(',');

    // Commission entries
    const commissionRows = stats.entries.map(entry => {
        const date = new Date(entry.created_at).toISOString().split('T')[0];
        const recipientName = entry.users?.name?.replace(/,/g, ' ') || 'Unknown';
        const recipientEmail = entry.users?.email || '';
        const clientName = entry.clients?.name?.replace(/,/g, ' ') || 'Unknown';
        const leadSource = entry.clients?.lead_source || 'N/A';
        const role = entry.split_role || 'coach';
        const gross = Number(entry.gross_amount).toFixed(2);
        const basis = (entry.calculation_basis as any);
        const fee = (basis?.stripe_fee || 0).toFixed(2);
        const basisType = basis?.basis || 'net';
        // For closer/setter show gross, for coach show remainder
        const basisAmount = basisType === 'gross'
            ? Number(entry.gross_amount).toFixed(2)
            : Number(entry.net_amount).toFixed(2);
        const rate = entry.split_percentage
            ? `${entry.split_percentage.toFixed(0)}%`
            : (basis?.rate
                ? `${(Number(basis.rate) * 100).toFixed(0)}%`
                : (basis?.flat_fee ? 'Flat' : 'N/A'));
        const commission = Number(entry.commission_amount).toFixed(2);
        const status = entry.status;

        return [
            date,
            'Commission',
            `"${recipientName}"`,
            recipientEmail,
            `"${clientName}"`,
            leadSource,
            role,
            gross,
            fee,
            basisAmount,
            basisType,
            rate,
            commission,
            status
        ].join(',');
    });

    // Adjustment entries
    const adjustmentRows = stats.adjustments.map(adj => {
        const date = new Date(adj.created_at).toISOString().split('T')[0];
        const userName = adj.users?.name?.replace(/,/g, ' ') || 'Unknown';
        const userEmail = adj.users?.email || '';
        const amount = Number(adj.amount).toFixed(2);

        return [
            date,
            `Adjustment (${adj.adjustment_type})`,
            `"${userName}"`,
            userEmail,
            `"${adj.reason.replace(/"/g, '""')}"`,
            '', // Lead Source
            '', // Role
            '', // Gross Amount
            '', // Stripe Fee
            '', // Basis Amount
            '', // Basis Type
            '', // Rate
            amount,
            'applied'
        ].join(',');
    });

    return [header, ...commissionRows, ...adjustmentRows].join('\n');
}

/**
 * Legacy export function for backwards compatibility.
 */
export async function generatePayrollExport(startDate: Date, endDate: Date, filters?: PayrollFilters): Promise<string> {
    if (filters?.payrollRunId) {
        return generateDetailedExport(filters.payrollRunId);
    }

    const stats = await getPayrollStats(startDate, endDate, filters);

    const header = [
        'Transaction Date',
        'Sale Date',
        'Client',
        'Lead Source',
        'Recipient',
        'Role',
        'Gross Amount',
        'Stripe Fee',
        'Basis Amount',
        'Basis Type',
        'Commission Rate',
        'Commission Amount',
        'Status',
        'Run ID'
    ].join(',');

    const rows = stats.entries.map(entry => {
        const date = new Date(entry.created_at).toISOString().split('T')[0];
        const saleDate = entry.clients?.start_date
            ? new Date(entry.clients.start_date).toISOString().split('T')[0]
            : 'N/A';
        const clientName = entry.clients?.name?.replace(/,/g, ' ') || 'Unknown';
        const leadSource = entry.clients?.lead_source || 'N/A';
        const userName = entry.users?.name?.replace(/,/g, ' ') || 'Unknown';
        const role = entry.split_role || 'coach';
        const gross = Number(entry.gross_amount).toFixed(2);
        const basis = (entry.calculation_basis as any);
        const fee = (basis?.stripe_fee || 0).toFixed(2);
        const basisType = basis?.basis || 'net';
        // For closer/setter show gross, for coach show remainder
        const basisAmount = basisType === 'gross'
            ? Number(entry.gross_amount).toFixed(2)
            : Number(entry.net_amount).toFixed(2);
        const rate = entry.split_percentage
            ? `${entry.split_percentage.toFixed(0)}%`
            : (basis?.rate
                ? `${(Number(basis.rate) * 100).toFixed(0)}%`
                : (basis?.flat_fee ? 'Flat' : '0%'));
        const commission = Number(entry.commission_amount).toFixed(2);
        const status = entry.status;
        const runId = entry.payroll_run_id || '';

        return [
            date,
            saleDate,
            clientName,
            leadSource,
            userName,
            role,
            gross,
            fee,
            basisAmount,
            basisType,
            rate,
            commission,
            status,
            runId
        ].join(',');
    });

    return [header, ...rows].join('\n');
}

// ============================================
// NOTIFICATIONS
// ============================================

async function createPayrollNotifications(runId: string, type: string, message: string): Promise<void> {
    const supabase = createAdminClient();

    // Get all users with entries in this run
    const { data: entries } = await supabase
        .from('commission_ledger')
        .select('user_id')
        .eq('payroll_run_id', runId);

    const { data: adjustments } = await supabase
        .from('commission_adjustments')
        .select('user_id')
        .eq('payroll_run_id', runId);

    // Combine and dedupe user IDs
    const userIds = new Set<string>();
    entries?.forEach(e => userIds.add(e.user_id));
    adjustments?.forEach(a => userIds.add(a.user_id));

    // Get run details for the message
    const { data: run } = await supabase
        .from('payroll_runs')
        .select('period_start, period_end, total_payout')
        .eq('id', runId)
        .single();

    const periodLabel = run
        ? `${format(new Date(run.period_start), 'MMM d')} - ${format(new Date(run.period_end), 'MMM d')}`
        : '';

    // Create notifications
    const notifications = Array.from(userIds).map(userId => ({
        user_id: userId,
        type,
        category: 'commission',
        message: `${message} (${periodLabel})`,
        payroll_run_id: runId,
        is_read: false
    }));

    if (notifications.length > 0) {
        await supabase.from('feature_notifications').insert(notifications);
    }
}

// ============================================
// COACH DASHBOARD HELPERS
// ============================================

/**
 * Get current period stats for a coach (or current user if not specified).
 */
export async function getCurrentPeriodStats(coachId?: string): Promise<{
    currentPeriod: { start: Date; end: Date; payoutDate: Date };
    earned: number;
    pending: number;
    adjustments: number;
    yearToDate: number;
}> {
    const user = await getCurrentUser();
    const admin = await isAdmin(user.id);
    const targetUserId = coachId || user.id;

    // Use admin client for admins to bypass RLS
    const supabase = admin ? createAdminClient() : await createClient();

    // Calculate current period (Monday-Sunday bi-weekly, anchored to Dec 16, 2024 LOCAL)
    const anchor = new Date(2024, 11, 16);
    anchor.setHours(0, 0, 0, 0);

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const diffTime = now.getTime() - anchor.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const periodIndex = Math.floor(diffDays / 14);

    const periodStart = new Date(anchor);
    periodStart.setDate(anchor.getDate() + (periodIndex * 14));

    const periodEnd = new Date(periodStart);
    periodEnd.setDate(periodEnd.getDate() + 13);
    periodEnd.setHours(23, 59, 59, 999);

    // Payout is Friday after period ends
    const payoutDate = new Date(periodEnd);
    const dayOfWeek = payoutDate.getDay();
    const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7;
    payoutDate.setDate(payoutDate.getDate() + daysUntilFriday);

    // Current period earnings (pending entries for this period)
    const { data: currentEntries } = await supabase
        .from('commission_ledger')
        .select('commission_amount')
        .eq('user_id', targetUserId)
        .eq('status', 'pending')
        .gte('created_at', periodStart.toISOString())
        .lte('created_at', periodEnd.toISOString());

    const earned = (currentEntries || []).reduce((sum, e) => sum + Number(e.commission_amount), 0);

    // Pending payout (all pending entries not in this period)
    const { data: pendingEntries } = await supabase
        .from('commission_ledger')
        .select('commission_amount')
        .eq('user_id', targetUserId)
        .eq('status', 'pending')
        .lt('created_at', periodStart.toISOString());

    const pending = (pendingEntries || []).reduce((sum, e) => sum + Number(e.commission_amount), 0);

    // Pending adjustments
    const { data: pendingAdjustments } = await supabase
        .from('commission_adjustments')
        .select('amount')
        .eq('user_id', targetUserId)
        .is('payroll_run_id', null);

    const adjustments = (pendingAdjustments || []).reduce((sum, a) => sum + Number(a.amount), 0);

    // Year to date (paid entries this year)
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const { data: ytdEntries } = await supabase
        .from('commission_ledger')
        .select('commission_amount')
        .eq('user_id', targetUserId)
        .eq('status', 'paid')
        .gte('paid_at', yearStart.toISOString());

    const yearToDate = (ytdEntries || []).reduce((sum, e) => sum + Number(e.commission_amount), 0);

    return {
        currentPeriod: { start: periodStart, end: periodEnd, payoutDate },
        earned,
        pending,
        adjustments,
        yearToDate
    };
}

// ============================================
// ADMIN: UNCALCULATED COMMISSIONS
// ============================================

export interface UncalculatedPayment {
    id: string;
    amount: number;
    payment_date: string;
    client_id: string | null;
    client_name: string | null;
    client_email: string | null;
    stripe_payment_id: string | null;
    status: string;
}

/**
 * Get all payments that have commission_calculated = false but are linked to a client
 * These are payments that slipped through (manual imports, webhook failures, etc.)
 */
export async function getUncalculatedPayments(): Promise<{
    payments: UncalculatedPayment[];
    orphanCount: number;
    error?: string;
}> {
    const user = await getCurrentUser();
    const admin = await isAdmin(user.id);

    if (!admin) {
        return { payments: [], orphanCount: 0, error: 'Unauthorized' };
    }

    const supabase = createAdminClient();

    // Get payments with commission_calculated = false that have a client_id
    const { data: uncalculated, error } = await supabase
        .from('payments')
        .select(`
            id,
            amount,
            payment_date,
            client_id,
            client_email,
            stripe_payment_id,
            status,
            clients:client_id (name)
        `)
        .eq('commission_calculated', false)
        .eq('status', 'succeeded')
        .not('client_id', 'is', null)
        .order('payment_date', { ascending: false });

    if (error) {
        console.error('getUncalculatedPayments error:', error);
        return { payments: [], orphanCount: 0, error: error.message };
    }

    // Also count orphan payments (no client_id)
    const { count: orphanCount } = await supabase
        .from('payments')
        .select('id', { count: 'exact', head: true })
        .eq('commission_calculated', false)
        .eq('status', 'succeeded')
        .is('client_id', null);

    const payments: UncalculatedPayment[] = (uncalculated || []).map(p => ({
        id: p.id,
        amount: p.amount,
        payment_date: p.payment_date,
        client_id: p.client_id,
        client_name: (p.clients as any)?.name || null,
        client_email: p.client_email,
        stripe_payment_id: p.stripe_payment_id,
        status: p.status
    }));

    return { payments, orphanCount: orphanCount || 0 };
}

/**
 * Process all uncalculated payments (batch operation)
 * Calls calculateCommission for each payment
 */
export async function processUncalculatedCommissions(): Promise<{
    processed: number;
    failed: number;
    skipped: number;
    errors: string[];
}> {
    const user = await getCurrentUser();
    const admin = await isAdmin(user.id);

    if (!admin) {
        return { processed: 0, failed: 0, skipped: 0, errors: ['Unauthorized'] };
    }

    const { calculateCommission } = await import('@/lib/logic/commissions');
    const supabase = createAdminClient();

    // Get all uncalculated payments with a client_id
    const { data: payments, error } = await supabase
        .from('payments')
        .select('id')
        .eq('commission_calculated', false)
        .eq('status', 'succeeded')
        .not('client_id', 'is', null);

    if (error || !payments) {
        return { processed: 0, failed: 0, skipped: 0, errors: [error?.message || 'Failed to fetch payments'] };
    }

    let processed = 0;
    let failed = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const payment of payments) {
        try {
            const result = await calculateCommission(payment.id);

            if (result.success) {
                if (result.skipped) {
                    skipped++;
                } else {
                    processed++;
                }
            } else {
                failed++;
                errors.push(`Payment ${payment.id}: ${result.reason}`);
            }
        } catch (err) {
            failed++;
            errors.push(`Payment ${payment.id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
    }

    // Log the batch operation
    await supabase.from('activity_logs').insert({
        action: 'batch_commission_process',
        entity_type: 'payments',
        user_id: user.id,
        metadata: {
            total: payments.length,
            processed,
            failed,
            skipped,
            timestamp: new Date().toISOString()
        }
    });

    revalidatePath('/commissions');

    return { processed, failed, skipped, errors: errors.slice(0, 10) }; // Limit errors to 10
}

/**
 * Recalculate commission for a single payment (admin action)
 */
export async function recalculateSinglePayment(paymentId: string, reason: string): Promise<{
    success: boolean;
    error?: string;
}> {
    const user = await getCurrentUser();
    const admin = await isAdmin(user.id);

    if (!admin) {
        return { success: false, error: 'Unauthorized' };
    }

    const { recalculateCommission } = await import('@/lib/logic/commissions');

    try {
        const result = await recalculateCommission(paymentId, user.id, reason);

        if (result.success) {
            revalidatePath('/commissions');
            return { success: true };
        }

        return { success: false, error: result.error };
    } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
}

// ============================================================================
// ORPHAN PAYMENT MANAGEMENT
// ============================================================================

export interface OrphanPayment {
    id: string;
    stripe_payment_id: string;
    amount: number;
    client_email: string | null;
    payment_date: string;
    status: string;
    review_status: string | null;
    created_at: string;
}

export interface ClientOption {
    id: string;
    name: string;
    email: string | null;
    assigned_coach_id: string | null;
}

/**
 * Get all orphan payments (payments without client_id)
 */
export async function getOrphanPayments(): Promise<{
    payments: OrphanPayment[];
    error?: string;
}> {
    const user = await getCurrentUser();
    const admin = await isAdmin(user.id);

    if (!admin) {
        return { payments: [], error: 'Unauthorized' };
    }

    // Use admin client to bypass RLS
    const supabase = createAdminClient();

    const { data: payments, error } = await supabase
        .from('payments')
        .select('id, stripe_payment_id, amount, client_email, payment_date, status, review_status, created_at')
        .is('client_id', null)
        .eq('status', 'succeeded')
        .order('payment_date', { ascending: false })
        .limit(100);

    if (error) {
        console.error('getOrphanPayments error:', error);
        return { payments: [], error: error.message };
    }

    return { payments: payments || [] };
}

/**
 * Search for clients to match with an orphan payment
 */
export async function searchClientsForMatch(query: string): Promise<{
    clients: ClientOption[];
    error?: string;
}> {
    const user = await getCurrentUser();
    const admin = await isAdmin(user.id);

    if (!admin) {
        return { clients: [], error: 'Unauthorized' };
    }

    if (!query || query.length < 2) {
        return { clients: [] };
    }

    // Use admin client to bypass RLS
    const supabase = createAdminClient();

    const { data: clients, error } = await supabase
        .from('clients')
        .select('id, name, email, assigned_coach_id')
        .or(`name.ilike.%${query}%,email.ilike.%${query}%`)
        .order('name')
        .limit(20);

    if (error) {
        console.error('searchClientsForMatch error:', error);
        return { clients: [], error: error.message };
    }

    return { clients: clients || [] };
}

/**
 * Batch recalculate commissions for a specific date range.
 * This is useful for fixing missing fees or updating calculations after rule changes.
 */
export async function recalculateCommissionsForPeriod(
    startDate: Date,
    endDate: Date
): Promise<{
    processed: number;
    failed: number;
    skipped: number;
    errors: string[];
}> {
    const user = await getCurrentUser();
    const admin = await isAdmin(user.id);

    if (!admin) {
        return { processed: 0, failed: 0, skipped: 0, errors: ['Unauthorized'] };
    }

    const { calculateCommission } = await import('@/lib/logic/commissions');
    const supabase = createAdminClient();

    // Fetch succeeded payments within the transaction date range
    // We check either payment_date OR created depending on what's populated
    const startStr = startDate.toISOString();
    const endStr = endDate.toISOString();

    const { data: payments, error } = await supabase
        .from('payments')
        .select('id')
        .eq('status', 'succeeded')
        .or(`payment_date.gte.${startStr},created.gte.${startStr}`) // Check start boundary
        .or(`payment_date.lte.${endStr},created.lte.${endStr}`);    // Check end boundary

    // Note: The OR logic above is a bit loose to catch everything, we'll filter strictly below

    if (error || !payments) {
        return { processed: 0, failed: 0, skipped: 0, errors: [error?.message || 'Failed to fetch payments'] };
    }

    let processed = 0;
    let failed = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Process checks
    for (const payment of payments) {
        try {
            // First void existing
            await supabase.rpc('void_commission_entries', { p_payment_id: payment.id });

            // Then recalculate
            const result = await calculateCommission(payment.id);

            if (result.success) {
                if (result.skipped) {
                    skipped++;
                } else {
                    processed++;
                }
            } else {
                failed++;
                errors.push(`Payment ${payment.id}: ${result.reason}`);
            }
        } catch (err) {
            failed++;
            errors.push(`Payment ${payment.id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
    }

    // Log activity
    await supabase.from('activity_logs').insert({
        action: 'batch_recalculate_period',
        entity_type: 'bulk_operation',
        user_id: user.id,
        metadata: {
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString(),
            processed,
            failed,
            skipped
        }
    });

    revalidatePath('/commissions');
    return { processed, failed, skipped, errors: errors.slice(0, 10) };
}

/**
 * Match an orphan payment to a client and calculate commission
 */
export async function matchOrphanPaymentToClient(
    paymentId: string,
    clientId: string
): Promise<{
    success: boolean;
    error?: string;
}> {
    const user = await getCurrentUser();
    const admin = await isAdmin(user.id);

    if (!admin) {
        return { success: false, error: 'Unauthorized' };
    }

    const { calculateCommissionAfterMatch } = await import('@/lib/logic/commissions');

    try {
        const result = await calculateCommissionAfterMatch(paymentId, clientId, user.id);

        if (result.success) {
            revalidatePath('/commissions');
            revalidatePath('/commissions/orphan-payments');
            return { success: true };
        }

        return { success: false, error: result.error };
    } catch (err) {
        console.error('matchOrphanPaymentToClient error:', err);
        return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
}

/**
 * Mark an orphan payment as excluded (won't be matched)
 */
export async function excludeOrphanPayment(
    paymentId: string,
    reason: string
): Promise<{
    success: boolean;
    error?: string;
}> {
    const user = await getCurrentUser();
    const admin = await isAdmin(user.id);

    if (!admin) {
        return { success: false, error: 'Unauthorized' };
    }

    const supabase = createAdminClient();

    const { error } = await supabase
        .from('payments')
        .update({
            review_status: 'excluded',
            matched_by: user.id,
            matched_at: new Date().toISOString()
        })
        .eq('id', paymentId);

    if (error) {
        console.error('excludeOrphanPayment error:', error);
        return { success: false, error: error.message };
    }

    // Log the exclusion
    await supabase.from('activity_logs').insert({
        action: 'payment_excluded',
        entity_type: 'payment',
        entity_id: paymentId,
        user_id: user.id,
        metadata: {
            reason,
            timestamp: new Date().toISOString()
        }
    });

    revalidatePath('/commissions/orphan-payments');
    return { success: true };
}
