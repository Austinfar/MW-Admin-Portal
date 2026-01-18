'use server';

import { createClient } from '@/lib/supabase/server';
import { startOfDay, endOfDay } from 'date-fns';
import { revalidatePath } from 'next/cache';

export interface PayrollRun {
    id: string;
    period_start: string;
    period_end: string;
    payout_date: string;
    status: 'draft' | 'locked' | 'paid' | 'void';
    total_amount: number;
    created_at: string;
}

export interface PayrollAdjustment {
    id: string;
    payroll_run_id: string;
    user_id: string;
    amount: number;
    reason: string;
    created_at: string;
}

export interface PayrollLedgerEntry {
    id: string;
    created_at: string;
    user_id: string;
    client_id: string;
    gross_amount: number;
    net_amount: number;
    commission_amount: number;
    status: 'pending' | 'paid' | 'void';
    payroll_run_id?: string;
    calculation_basis: any;
    users?: { name: string; email: string };
    clients?: { name: string; start_date?: string };
}

export interface PayrollStats {
    entries: PayrollLedgerEntry[];
    totalCommission: number;
    totalVolume: number;
    summary: {
        totalPayout: number;
        totalDeals: number;
        topEarner: { name: string; amount: number };
        byUser: Record<string, { name: string; amount: number; deals: number }>;
    };
    run?: PayrollRun;
    adjustments: PayrollAdjustmentWithUser[];
}

export interface PayrollAdjustmentWithUser extends PayrollAdjustment {
    users?: { name: string; email: string };
}

export type PayrollFilters = {
    coachId?: string;
    clientType?: string;
    searchQuery?: string;
    sortBy?: 'date' | 'amount' | 'client' | 'coach';
    sortOrder?: 'asc' | 'desc';
    payrollRunId?: string;
};

export async function getAllUsers() {
    const supabase = await createClient();
    const { data } = await supabase.from('users').select('id, name').order('name');
    return data || [];
}

export async function getPayrollHistory(): Promise<PayrollRun[]> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    // Admin check - only admins see history for now?
    // "Admins can view all users"

    const { data, error } = await supabase
        .from('payroll_runs')
        .select('*')
        .order('period_end', { ascending: false });

    if (error) {
        console.error('Error fetching payroll history:', error);
        return [];
    }

    return data as PayrollRun[];
}

export async function lockPayrollRun(periodStart: Date, periodEnd: Date, payoutDate: Date) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    // 1. Create Run
    const { data: run, error: runError } = await supabase
        .from('payroll_runs')
        .insert({
            period_start: periodStart.toISOString(),
            period_end: periodEnd.toISOString(),
            payout_date: payoutDate.toISOString(),
            status: 'draft',
            created_by: user.id
        })
        .select()
        .single();

    if (runError) throw new Error(`Failed to create run: ${runError.message}`);

    // 2. Lock Ledger Items
    // Find all pending items created <= periodEnd that are NOT already in a run
    const { error: updateError } = await supabase
        .from('commission_ledger')
        .update({ payroll_run_id: run.id })
        .eq('status', 'pending')
        .lte('created_at', endOfDay(periodEnd).toISOString())
        .is('payroll_run_id', null);

    if (updateError) throw new Error(`Failed to link ledger items: ${updateError.message}`);

    // 3. Calc Total
    // We can do this by fetching stats for this run ID
    const stats = await getPayrollStats(periodStart, periodEnd, { payrollRunId: run.id });
    const total = stats.totalCommission;

    const { error: totalError } = await supabase
        .from('payroll_runs')
        .update({ total_amount: total })
        .eq('id', run.id);

    if (totalError) console.error('Failed to update run total', totalError);

    revalidatePath('/dashboard/commissions');
    return run;
}

export async function markPayrollPaid(runId: string) {
    const supabase = await createClient();

    // 1. Update Run
    const { error: runError } = await supabase
        .from('payroll_runs')
        .update({ status: 'paid' })
        .eq('id', runId);

    if (runError) throw new Error(`Failed to mark run paid: ${runError.message}`);

    // 2. Update Ledger items
    const { error: ledgerError } = await supabase
        .from('commission_ledger')
        .update({ status: 'paid' })
        .eq('payroll_run_id', runId);

    if (ledgerError) throw new Error(`Failed to update ledger status: ${ledgerError.message}`);

    revalidatePath('/dashboard/commissions');
}

export async function addAdjustment(runId: string, userId: string, amount: number, reason: string) {
    const supabase = await createClient();
    const { error } = await supabase.from('payroll_adjustments').insert({
        payroll_run_id: runId,
        user_id: userId,
        amount,
        reason
    });

    if (error) throw new Error(`Failed to add adjustment: ${error.message}`);

    // Recalculate run total
    const stats = await getPayrollStats(new Date(), new Date(), { payrollRunId: runId });
    await supabase.from('payroll_runs').update({ total_amount: stats.totalCommission }).eq('id', runId);

    revalidatePath('/dashboard/commissions');
}

export async function removeAdjustment(id: string, runId: string) {
    const supabase = await createClient();
    const { error } = await supabase.from('payroll_adjustments').delete().eq('id', id);

    if (error) throw new Error(`Failed to remove adjustment: ${error.message}`);

    // Recalculate run total
    const stats = await getPayrollStats(new Date(), new Date(), { payrollRunId: runId });
    await supabase.from('payroll_runs').update({ total_amount: stats.totalCommission }).eq('id', runId);

    revalidatePath('/dashboard/commissions');
}

export async function getPayrollStats(startDate: Date, endDate: Date, filters?: PayrollFilters): Promise<PayrollStats> {
    const supabase = await createClient();

    // Check Permissions
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    // Fetch User Role
    const { data: userProfile } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

    const isAdmin = userProfile?.role === 'admin';

    // Build Query
    let query = supabase
        .from('commission_ledger')
        .select(`
            *,
            users:user_id (name, email),
            clients:client_id!inner (name, lead_source, start_date)
        `);

    // Strict Filter Logic:
    // If payrollRunId is provided, we ONLY filter by that ID. Date range is ignored.
    // Otherwise, we use Date Range and filter out items that are already in a CLOSED run? 
    // Or do we show everything in the date range regardless of run status?
    // Current design: Date Picker shows commission activity in that period. 
    // If it's in a run, it should show up.

    if (filters?.payrollRunId) {
        query = query.eq('payroll_run_id', filters.payrollRunId);
    } else {
        query = query
            .gte('created_at', startOfDay(startDate).toISOString())
            .lte('created_at', endOfDay(endDate).toISOString());
    }

    // Apply Filters
    if (filters?.coachId && isAdmin) {
        query = query.eq('user_id', filters.coachId);
    }

    if (filters?.clientType) {
        query = query.eq('clients.lead_source', filters.clientType);
    }

    // Sort logic
    if (filters?.sortBy) {
        const order = filters.sortOrder === 'asc';
        switch (filters.sortBy) {
            case 'amount':
                query = query.order('commission_amount', { ascending: order });
                break;
            case 'date':
                query = query.order('created_at', { ascending: order });
                break;
            default:
                query = query.order('created_at', { ascending: order });
        }
    } else {
        query = query.order('created_at', { ascending: false });
    }

    // Restrict if not admin
    if (!isAdmin) {
        query = query.eq('user_id', user.id);
    }

    const { data: commissions, error } = await query;

    if (error) {
        console.error('Error fetching payroll stats:', error);
        throw new Error(`Failed to fetch payroll stats: ${error.message} (${error.code})`);
    }

    // Aggregation Logic
    const summary = {
        totalPayout: 0,
        totalDeals: 0,
        topEarner: { name: 'N/A', amount: 0 },
        byUser: {} as Record<string, { name: string, amount: number, deals: number }>
    };

    // Filter in-memory for Search Query
    let filteredCommissions = commissions;
    if (filters?.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        filteredCommissions = commissions.filter(c =>
            (c.users?.name?.toLowerCase() || '').includes(query) ||
            (c.clients?.name?.toLowerCase() || '').includes(query) ||
            (c.users?.email?.toLowerCase() || '').includes(query)
        );
    }

    // Recalculate summary stats based on filtered data
    summary.totalDeals = filteredCommissions.length;

    filteredCommissions.forEach(comm => {
        const amount = Number(comm.commission_amount);
        summary.totalPayout += amount;

        const userName = comm.users?.name || 'Unknown';
        const userId = comm.user_id;

        if (!summary.byUser[userId]) {
            summary.byUser[userId] = { name: userName, amount: 0, deals: 0 };
        }

        summary.byUser[userId].amount += amount;
        summary.byUser[userId].deals += 1;
    });

    // Calculate Top Earner
    let max = 0;
    Object.values(summary.byUser).forEach(u => {
        if (u.amount > max) {
            max = u.amount;
            summary.topEarner = { name: u.name, amount: u.amount };
        }
    });

    // Fetch Adjustments if specific run
    let adjustments: PayrollAdjustmentWithUser[] = [];
    if (filters?.payrollRunId) {
        const { data: adjData } = await supabase
            .from('payroll_adjustments')
            .select('*, users:user_id(name, email)')
            .eq('payroll_run_id', filters.payrollRunId);

        if (adjData) {
            adjustments = adjData as any; // Type assertion needed for joined data
        }
    }

    // Apply adjustments to summary
    adjustments.forEach(adj => {
        const amount = Number(adj.amount);
        summary.totalPayout += amount;

        const userId = adj.user_id;
        const userName = adj.users?.name || 'Unknown';

        if (!summary.byUser[userId]) {
            summary.byUser[userId] = { name: userName, amount: 0, deals: 0 };
        }

        summary.byUser[userId].amount += amount;
    });

    // Re-calculate top earner after adjustments
    summary.topEarner = { name: 'N/A', amount: 0 }; // Reset
    Object.values(summary.byUser).forEach(u => {
        if (u.amount > summary.topEarner.amount) {
            summary.topEarner = { name: u.name, amount: u.amount };
        }
    });

    return {
        entries: filteredCommissions as any[] as PayrollLedgerEntry[],
        adjustments,
        totalCommission: summary.totalPayout,
        totalVolume: filteredCommissions.reduce((sum, c) => sum + Number(c.net_amount), 0),
        summary
    };
}

export async function generatePayrollExport(startDate: Date, endDate: Date, filters?: PayrollFilters): Promise<string> {
    const stats = await getPayrollStats(startDate, endDate, filters);

    // CSV Header
    const header = [
        'Transaction Date', // Renamed from Date
        'Sale Date',        // NEW
        'Client',
        'Lead Source',
        'Closer / Recipient',
        'Gross Amount',
        'Stripe Fee',
        'Net Basis',
        'Commission Rate',
        'Commission Amount',
        'Status',
        'Run ID'
    ].join(',');

    // Map rows
    const rows = stats.entries.map(entry => {
        const date = new Date(entry.created_at).toISOString().split('T')[0];
        const saleDate = entry.clients?.start_date ? new Date(entry.clients.start_date).toISOString().split('T')[0] : 'N/A';
        const clientName = entry.clients?.name?.replace(/,/g, ' ') || 'Unknown';
        const leadSource = (entry.clients as any)?.lead_source || 'N/A';
        const userName = entry.users?.name?.replace(/,/g, ' ') || 'Unknown';
        const gross = Number(entry.gross_amount).toFixed(2);

        // Fee might be in calculation_basis
        const fee = (entry.calculation_basis as any)?.stripe_fee
            ? Number((entry.calculation_basis as any).stripe_fee).toFixed(2)
            : '0.00';

        const net = Number(entry.net_amount).toFixed(2);
        const rate = (entry.calculation_basis as any)?.rate
            ? (Number((entry.calculation_basis as any).rate) * 100).toFixed(0) + '%'
            : '0%';

        const commission = Number(entry.commission_amount).toFixed(2);
        const status = entry.status;
        const runId = entry.payroll_run_id || '';

        return [
            date,
            saleDate,
            clientName,
            leadSource,
            userName,
            gross,
            fee,
            net,
            rate,
            commission,
            status,
            runId
        ].join(',');
    });

    return [header, ...rows].join('\n');
}
