'use server';

import { createAdminClient } from '@/lib/supabase/admin';

export interface CommissionSummaryMetrics {
    totalCommissionsPaid: number;
    totalCommissionsPending: number;
    totalAdjustments: number;
    averageCommissionPerDeal: number;
    commissionAsPercentOfRevenue: number;
    totalGrossRevenue: number;
    transactionCount: number;
}

export interface CoachEarnings {
    coachId: string;
    coachName: string;
    totalEarnings: number;
    dealsClosed: number;
    averageCommission: number;
    role: string;
}

export interface RoleBreakdown {
    role: string;
    totalAmount: number;
    count: number;
    percentage: number;
}

export interface LeadSourceBreakdown {
    leadSource: string;
    totalAmount: number;
    count: number;
    percentage: number;
}

export interface MonthlyTrend {
    month: string;
    year: number;
    totalCommission: number;
    totalGross: number;
    transactionCount: number;
}

export interface PayrollMetrics {
    totalRuns: number;
    draftRuns: number;
    approvedRuns: number;
    paidRuns: number;
    voidedRuns: number;
    averageApprovalTime: number; // in hours
    totalPaidOut: number;
}

/**
 * Get summary metrics for commission analytics
 */
export async function getCommissionSummaryMetrics(
    startDate?: Date,
    endDate?: Date
): Promise<CommissionSummaryMetrics> {
    const supabase = createAdminClient();

    let query = supabase
        .from('commission_ledger')
        .select('commission_amount, gross_amount, status, created_at');

    if (startDate) {
        query = query.gte('created_at', startDate.toISOString());
    }
    if (endDate) {
        query = query.lte('created_at', endDate.toISOString());
    }

    const { data: entries, error } = await query;

    if (error || !entries) {
        console.error('Error fetching commission metrics:', error);
        return {
            totalCommissionsPaid: 0,
            totalCommissionsPending: 0,
            totalAdjustments: 0,
            averageCommissionPerDeal: 0,
            commissionAsPercentOfRevenue: 0,
            totalGrossRevenue: 0,
            transactionCount: 0,
        };
    }

    const paid = entries.filter(e => e.status === 'paid');
    const pending = entries.filter(e => e.status === 'pending');

    const totalCommissionsPaid = paid.reduce((sum, e) => sum + Number(e.commission_amount), 0);
    const totalCommissionsPending = pending.reduce((sum, e) => sum + Number(e.commission_amount), 0);
    const totalGrossRevenue = entries.reduce((sum, e) => sum + Number(e.gross_amount), 0);
    const totalCommissions = totalCommissionsPaid + totalCommissionsPending;

    // Get adjustments
    let adjustmentQuery = supabase
        .from('commission_adjustments')
        .select('amount');

    if (startDate) {
        adjustmentQuery = adjustmentQuery.gte('created_at', startDate.toISOString());
    }
    if (endDate) {
        adjustmentQuery = adjustmentQuery.lte('created_at', endDate.toISOString());
    }

    const { data: adjustments } = await adjustmentQuery;
    const totalAdjustments = (adjustments || []).reduce((sum, a) => sum + Number(a.amount), 0);

    return {
        totalCommissionsPaid,
        totalCommissionsPending,
        totalAdjustments,
        averageCommissionPerDeal: entries.length > 0 ? totalCommissions / entries.length : 0,
        commissionAsPercentOfRevenue: totalGrossRevenue > 0 ? (totalCommissions / totalGrossRevenue) * 100 : 0,
        totalGrossRevenue,
        transactionCount: entries.length,
    };
}

/**
 * Get top earners leaderboard
 */
export async function getTopEarners(
    limit: number = 10,
    period: 'month' | 'quarter' | 'year' | 'all' = 'month'
): Promise<CoachEarnings[]> {
    const supabase = createAdminClient();

    // Calculate date range
    const now = new Date();
    let startDate: Date | null = null;

    if (period === 'month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (period === 'quarter') {
        const quarterStart = Math.floor(now.getMonth() / 3) * 3;
        startDate = new Date(now.getFullYear(), quarterStart, 1);
    } else if (period === 'year') {
        startDate = new Date(now.getFullYear(), 0, 1);
    }

    let query = supabase
        .from('commission_ledger')
        .select(`
            user_id,
            commission_amount,
            split_role,
            users:user_id (name)
        `);

    if (startDate) {
        query = query.gte('created_at', startDate.toISOString());
    }

    const { data: entries, error } = await query;

    if (error || !entries) {
        console.error('Error fetching top earners:', error);
        return [];
    }

    // Aggregate by user
    const earningsMap = new Map<string, {
        name: string;
        total: number;
        deals: number;
        role: string;
    }>();

    for (const entry of entries) {
        const userId = entry.user_id;
        const userName = (entry.users as any)?.name || 'Unknown';
        const existing = earningsMap.get(userId) || { name: userName, total: 0, deals: 0, role: entry.split_role || 'coach' };

        existing.total += Number(entry.commission_amount);
        existing.deals += 1;
        earningsMap.set(userId, existing);
    }

    // Convert to array and sort
    const leaderboard: CoachEarnings[] = Array.from(earningsMap.entries())
        .map(([coachId, data]) => ({
            coachId,
            coachName: data.name,
            totalEarnings: data.total,
            dealsClosed: data.deals,
            averageCommission: data.deals > 0 ? data.total / data.deals : 0,
            role: data.role,
        }))
        .sort((a, b) => b.totalEarnings - a.totalEarnings)
        .slice(0, limit);

    return leaderboard;
}

/**
 * Get commission breakdown by role
 */
export async function getCommissionsByRole(
    startDate?: Date,
    endDate?: Date
): Promise<RoleBreakdown[]> {
    const supabase = createAdminClient();

    let query = supabase
        .from('commission_ledger')
        .select('split_role, commission_amount');

    if (startDate) {
        query = query.gte('created_at', startDate.toISOString());
    }
    if (endDate) {
        query = query.lte('created_at', endDate.toISOString());
    }

    const { data: entries, error } = await query;

    if (error || !entries) {
        return [];
    }

    // Aggregate by role
    const roleMap = new Map<string, { amount: number; count: number }>();

    for (const entry of entries) {
        const role = entry.split_role || 'coach';
        const existing = roleMap.get(role) || { amount: 0, count: 0 };
        existing.amount += Number(entry.commission_amount);
        existing.count += 1;
        roleMap.set(role, existing);
    }

    const total = Array.from(roleMap.values()).reduce((sum, r) => sum + r.amount, 0);

    return Array.from(roleMap.entries())
        .map(([role, data]) => ({
            role,
            totalAmount: data.amount,
            count: data.count,
            percentage: total > 0 ? (data.amount / total) * 100 : 0,
        }))
        .sort((a, b) => b.totalAmount - a.totalAmount);
}

/**
 * Get commission breakdown by lead source
 */
export async function getCommissionsByLeadSource(
    startDate?: Date,
    endDate?: Date
): Promise<LeadSourceBreakdown[]> {
    const supabase = createAdminClient();

    let query = supabase
        .from('commission_ledger')
        .select(`
            commission_amount,
            calculation_basis,
            clients:client_id (lead_source)
        `);

    if (startDate) {
        query = query.gte('created_at', startDate.toISOString());
    }
    if (endDate) {
        query = query.lte('created_at', endDate.toISOString());
    }

    const { data: entries, error } = await query;

    if (error || !entries) {
        return [];
    }

    // Aggregate by lead source
    const sourceMap = new Map<string, { amount: number; count: number }>();

    for (const entry of entries) {
        // Try to get lead_source from client, or from calculation_basis
        const basis = entry.calculation_basis as any;
        const leadSource = (entry.clients as any)?.lead_source || basis?.lead_source || 'unknown';

        const existing = sourceMap.get(leadSource) || { amount: 0, count: 0 };
        existing.amount += Number(entry.commission_amount);
        existing.count += 1;
        sourceMap.set(leadSource, existing);
    }

    const total = Array.from(sourceMap.values()).reduce((sum, s) => sum + s.amount, 0);

    return Array.from(sourceMap.entries())
        .map(([leadSource, data]) => ({
            leadSource,
            totalAmount: data.amount,
            count: data.count,
            percentage: total > 0 ? (data.amount / total) * 100 : 0,
        }))
        .sort((a, b) => b.totalAmount - a.totalAmount);
}

/**
 * Get monthly commission trends
 */
export async function getCommissionTrends(
    months: number = 12
): Promise<MonthlyTrend[]> {
    const supabase = createAdminClient();

    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);
    startDate.setDate(1);

    const { data: entries, error } = await supabase
        .from('commission_ledger')
        .select('commission_amount, gross_amount, created_at')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

    if (error || !entries) {
        return [];
    }

    // Group by month
    const monthMap = new Map<string, { commission: number; gross: number; count: number }>();

    for (const entry of entries) {
        const date = new Date(entry.created_at);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        const existing = monthMap.get(key) || { commission: 0, gross: 0, count: 0 };
        existing.commission += Number(entry.commission_amount);
        existing.gross += Number(entry.gross_amount);
        existing.count += 1;
        monthMap.set(key, existing);
    }

    // Convert to array with month names
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    return Array.from(monthMap.entries())
        .map(([key, data]) => {
            const [year, month] = key.split('-').map(Number);
            return {
                month: monthNames[month - 1],
                year,
                totalCommission: data.commission,
                totalGross: data.gross,
                transactionCount: data.count,
            };
        })
        .sort((a, b) => {
            if (a.year !== b.year) return a.year - b.year;
            return monthNames.indexOf(a.month) - monthNames.indexOf(b.month);
        });
}

/**
 * Get payroll run metrics
 */
export async function getPayrollMetrics(): Promise<PayrollMetrics> {
    const supabase = createAdminClient();

    const { data: runs, error } = await supabase
        .from('payroll_runs')
        .select('status, total_payout, created_at, approved_at');

    if (error || !runs) {
        return {
            totalRuns: 0,
            draftRuns: 0,
            approvedRuns: 0,
            paidRuns: 0,
            voidedRuns: 0,
            averageApprovalTime: 0,
            totalPaidOut: 0,
        };
    }

    const draft = runs.filter(r => r.status === 'draft');
    const approved = runs.filter(r => r.status === 'approved');
    const paid = runs.filter(r => r.status === 'paid');
    const voided = runs.filter(r => r.status === 'void');

    // Calculate average approval time
    const approvedRuns = runs.filter(r => r.approved_at && r.created_at);
    let totalApprovalTime = 0;

    for (const run of approvedRuns) {
        const created = new Date(run.created_at);
        const approved = new Date(run.approved_at);
        totalApprovalTime += (approved.getTime() - created.getTime()) / (1000 * 60 * 60); // hours
    }

    const avgApprovalTime = approvedRuns.length > 0 ? totalApprovalTime / approvedRuns.length : 0;

    // Total paid out
    const totalPaidOut = paid.reduce((sum, r) => sum + Number(r.total_payout || 0), 0);

    return {
        totalRuns: runs.length,
        draftRuns: draft.length,
        approvedRuns: approved.length,
        paidRuns: paid.length,
        voidedRuns: voided.length,
        averageApprovalTime: avgApprovalTime,
        totalPaidOut,
    };
}

/**
 * Get scheduled future payments and estimated commissions
 */
export async function getCommissionForecast(): Promise<{
    scheduledPayments: number;
    estimatedCommissions: number;
    upcomingCount: number;
}> {
    const supabase = createAdminClient();

    const now = new Date();
    const threeMonthsAhead = new Date();
    threeMonthsAhead.setMonth(threeMonthsAhead.getMonth() + 3);

    // Get upcoming scheduled charges
    const { data: charges, error } = await supabase
        .from('scheduled_charges')
        .select(`
            amount,
            status,
            schedule:schedule_id (
                assigned_coach_id,
                client:client_id (lead_source, is_resign)
            )
        `)
        .eq('status', 'pending')
        .gte('due_date', now.toISOString())
        .lte('due_date', threeMonthsAhead.toISOString());

    if (error || !charges) {
        return {
            scheduledPayments: 0,
            estimatedCommissions: 0,
            upcomingCount: 0,
        };
    }

    let totalScheduled = 0;
    let totalEstimatedCommission = 0;

    for (const charge of charges) {
        const amount = Number(charge.amount) / 100; // Convert cents to dollars
        totalScheduled += amount;

        // Estimate commission (50-70% of net after ~3% stripe fee)
        const netAmount = amount * 0.97;
        const schedule = charge.schedule as any;
        const isCoachLead = schedule?.client?.lead_source === 'coach_driven';
        const isResign = schedule?.client?.is_resign;
        const rate = (isCoachLead || isResign) ? 0.70 : 0.50;

        totalEstimatedCommission += netAmount * rate;
    }

    return {
        scheduledPayments: totalScheduled,
        estimatedCommissions: totalEstimatedCommission,
        upcomingCount: charges.length,
    };
}
