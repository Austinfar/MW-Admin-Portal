'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { getBusinessMetrics, BusinessMetrics } from './analytics';
import { getCommissionSummaryMetrics, CommissionSummaryMetrics } from './commission-analytics';
import { UserPermissions } from '@/lib/auth-utils';
import { Payment } from '@/types/payment';

// Dashboard data types
export interface ClientStats {
    total: number;
    active: number;
    onboarding: number;
    inactive: number;
    myClients?: number; // For coaches - their assigned clients
}

export interface OnboardingStats {
    totalTasks: number;
    completedTasks: number;
    overdueTasks: number;
    pendingTasks: number;
}

export interface SalesFunnelData {
    booked: number;
    showed: number;
    closed: number;
    conversionRate: number; // booked to closed
}

export interface PersonalCommission {
    pending: number;
    paidThisMonth: number;
    paidTotal: number;
}

export interface AlertItem {
    id: string;
    type: 'failed_payment' | 'overdue_task' | 'system';
    title: string;
    description: string;
    severity: 'error' | 'warning' | 'info';
    href?: string;
    timestamp: string;
}

export interface ActivityItem {
    id: string;
    type: 'payment' | 'client' | 'lead' | 'onboarding';
    title: string;
    description: string;
    timestamp: string;
    amount?: number;
    status?: string;
}

// Aggregated dashboard data
export interface DashboardData {
    // Business metrics (admin/super_admin)
    businessMetrics?: BusinessMetrics;

    // Commission summary (admins)
    commissionSummary?: CommissionSummaryMetrics;

    // Personal commission (all earning roles)
    personalCommission?: PersonalCommission;

    // Client stats (coaches, admins)
    clientStats?: ClientStats;

    // Onboarding stats (coaches, operations)
    onboardingStats?: OnboardingStats;

    // Sales funnel (sales roles, admins)
    salesFunnel?: SalesFunnelData;

    // Alerts (admins, operations)
    alerts?: AlertItem[];

    // Recent activity (all)
    recentActivity?: ActivityItem[];
}

/**
 * Get dashboard data based on user role and job title
 */
export async function getDashboardData(
    userId: string,
    role: 'super_admin' | 'admin' | 'user',
    jobTitle: string | null,
    permissions: UserPermissions
): Promise<DashboardData> {
    const data: DashboardData = {};

    // Determine what data to fetch based on role
    const isAdmin = role === 'super_admin' || role === 'admin';
    const isCoach = jobTitle === 'coach' || jobTitle === 'head_coach';
    const isSales = jobTitle === 'closer' || jobTitle === 'setter';
    const isOperations = jobTitle === 'operations' || jobTitle === 'admin_staff';

    // Build promises array for parallel fetching
    const promises: Promise<void>[] = [];

    // Business metrics for admins
    if (isAdmin || permissions.can_view_business === 'all') {
        promises.push(
            getBusinessMetrics().then(metrics => {
                data.businessMetrics = metrics;
            }).catch(err => {
                console.error('[DashboardData] Error fetching business metrics:', err);
            })
        );
    }

    // Commission summary for admins
    if (isAdmin || permissions.can_view_commissions === 'all') {
        promises.push(
            getCommissionSummaryMetrics().then(summary => {
                data.commissionSummary = summary;
            }).catch(err => {
                console.error('[DashboardData] Error fetching commission summary:', err);
            })
        );
    }

    // Personal commission for users who can view their own commissions
    if (permissions.can_view_commissions === 'own' || permissions.can_view_commissions === 'all') {
        promises.push(
            getPersonalCommission(userId).then(commission => {
                data.personalCommission = commission;
            }).catch(err => {
                console.error('[DashboardData] Error fetching personal commission:', err);
            })
        );
    }

    // Client stats for coaches and admins
    if (isAdmin || isCoach || permissions.can_view_clients === 'all' || permissions.can_view_clients === 'own') {
        promises.push(
            getClientStats(userId, isCoach && !isAdmin).then(stats => {
                data.clientStats = stats;
            }).catch(err => {
                console.error('[DashboardData] Error fetching client stats:', err);
            })
        );
    }

    // Onboarding stats for coaches, operations, and admins
    if (isAdmin || isCoach || isOperations || permissions.can_view_onboarding === 'all' || permissions.can_view_onboarding === 'own') {
        promises.push(
            getOnboardingStats(userId, isCoach && !isAdmin).then(stats => {
                data.onboardingStats = stats;
            }).catch(err => {
                console.error('[DashboardData] Error fetching onboarding stats:', err);
            })
        );
    }

    // Sales funnel for sales roles and admins
    if (isAdmin || isSales || permissions.can_view_sales_floor === 'all') {
        promises.push(
            getSalesFunnelData().then(funnel => {
                data.salesFunnel = funnel;
            }).catch(err => {
                console.error('[DashboardData] Error fetching sales funnel:', err);
            })
        );
    }

    // Alerts for admins and operations
    if (isAdmin || isOperations) {
        promises.push(
            getAlerts().then(alerts => {
                data.alerts = alerts;
            }).catch(err => {
                console.error('[DashboardData] Error fetching alerts:', err);
            })
        );
    }

    // Recent activity for all
    promises.push(
        getRecentActivity(userId, isAdmin).then(activity => {
            data.recentActivity = activity;
        }).catch(err => {
            console.error('[DashboardData] Error fetching recent activity:', err);
        })
    );

    // Wait for all fetches to complete
    await Promise.all(promises);

    return data;
}

/**
 * Get personal commission data for a user
 */
async function getPersonalCommission(userId: string): Promise<PersonalCommission> {
    const supabase = createAdminClient();

    // Get current month start
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const { data: entries } = await supabase
        .from('commission_ledger')
        .select('commission_amount, status, paid_at')
        .eq('user_id', userId);

    if (!entries) {
        return { pending: 0, paidThisMonth: 0, paidTotal: 0 };
    }

    const pending = entries
        .filter(e => e.status === 'pending')
        .reduce((sum, e) => sum + Number(e.commission_amount), 0);

    const paidTotal = entries
        .filter(e => e.status === 'paid')
        .reduce((sum, e) => sum + Number(e.commission_amount), 0);

    const paidThisMonth = entries
        .filter(e => e.status === 'paid' && e.paid_at && new Date(e.paid_at) >= monthStart)
        .reduce((sum, e) => sum + Number(e.commission_amount), 0);

    return { pending, paidThisMonth, paidTotal };
}

/**
 * Get client statistics
 */
async function getClientStats(userId: string, ownOnly: boolean): Promise<ClientStats> {
    const supabase = createAdminClient();

    let query = supabase.from('clients').select('id, status, assigned_coach_id');

    if (ownOnly) {
        query = query.eq('assigned_coach_id', userId);
    }

    const { data: clients } = await query;

    if (!clients) {
        return { total: 0, active: 0, onboarding: 0, inactive: 0 };
    }

    const active = clients.filter(c => c.status === 'active').length;
    const onboarding = clients.filter(c => c.status === 'onboarding').length;
    const inactive = clients.filter(c => c.status === 'inactive' || c.status === 'lost').length;

    const stats: ClientStats = {
        total: clients.length,
        active,
        onboarding,
        inactive
    };

    // If ownOnly, all clients are "my clients"
    if (ownOnly) {
        stats.myClients = clients.length;
    } else {
        // Get my assigned clients count
        const myClients = clients.filter(c => c.assigned_coach_id === userId).length;
        stats.myClients = myClients;
    }

    return stats;
}

/**
 * Get onboarding statistics
 */
async function getOnboardingStats(userId: string, ownOnly: boolean): Promise<OnboardingStats> {
    const supabase = createAdminClient();

    // Get onboarding tasks
    let query = supabase
        .from('onboarding_tasks')
        .select('id, status, due_date, client:client_id(assigned_coach_id)');

    const { data: tasks } = await query;

    if (!tasks) {
        return { totalTasks: 0, completedTasks: 0, overdueTasks: 0, pendingTasks: 0 };
    }

    // Filter by own clients if needed
    let filteredTasks = tasks;
    if (ownOnly) {
        filteredTasks = tasks.filter((t: any) => t.client?.assigned_coach_id === userId);
    }

    const now = new Date();
    const completed = filteredTasks.filter(t => t.status === 'completed').length;
    const pending = filteredTasks.filter(t => t.status === 'pending').length;
    const overdue = filteredTasks.filter(t =>
        t.status === 'pending' && t.due_date && new Date(t.due_date) < now
    ).length;

    return {
        totalTasks: filteredTasks.length,
        completedTasks: completed,
        overdueTasks: overdue,
        pendingTasks: pending
    };
}

/**
 * Get sales funnel data (last 30 days)
 */
async function getSalesFunnelData(): Promise<SalesFunnelData> {
    const supabase = createAdminClient();

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get leads created in last 30 days
    const { data: leads } = await supabase
        .from('leads')
        .select('id, status, created_at')
        .gte('created_at', thirtyDaysAgo.toISOString());

    if (!leads) {
        return { booked: 0, showed: 0, closed: 0, conversionRate: 0 };
    }

    // Count by status
    const booked = leads.filter(l =>
        l.status === 'Appt Set' || l.status === 'Contacted' || l.status === 'Closed Won' || l.status === 'Closed Lost'
    ).length;

    const showed = leads.filter(l =>
        l.status === 'Closed Won' || l.status === 'Closed Lost'
    ).length;

    const closed = leads.filter(l => l.status === 'Closed Won').length;

    const conversionRate = booked > 0 ? (closed / booked) * 100 : 0;

    return { booked, showed, closed, conversionRate };
}

/**
 * Get alerts for admin dashboard
 */
async function getAlerts(): Promise<AlertItem[]> {
    const supabase = createAdminClient();
    const alerts: AlertItem[] = [];

    // Get failed payments
    const { data: failedPayments } = await supabase
        .from('payments')
        .select('id, client_email, amount, created_at, status')
        .in('status', ['failed', 'disputed'])
        .order('created_at', { ascending: false })
        .limit(5);

    if (failedPayments) {
        failedPayments.forEach(p => {
            alerts.push({
                id: `payment-${p.id}`,
                type: 'failed_payment',
                title: p.status === 'disputed' ? 'Payment Disputed' : 'Payment Failed',
                description: `${p.client_email || 'Unknown'} - $${p.amount.toFixed(2)}`,
                severity: 'error',
                href: '/business',
                timestamp: p.created_at
            });
        });
    }

    // Get overdue onboarding tasks
    const now = new Date();
    const { data: overdueTasks } = await supabase
        .from('onboarding_tasks')
        .select('id, task_name, due_date, client:client_id(name)')
        .eq('status', 'pending')
        .lt('due_date', now.toISOString())
        .order('due_date', { ascending: true })
        .limit(5);

    if (overdueTasks) {
        overdueTasks.forEach((t: any) => {
            alerts.push({
                id: `task-${t.id}`,
                type: 'overdue_task',
                title: 'Overdue Task',
                description: `${t.task_name} - ${t.client?.name || 'Unknown client'}`,
                severity: 'warning',
                href: '/onboarding',
                timestamp: t.due_date
            });
        });
    }

    // Sort by timestamp (most recent first)
    alerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return alerts.slice(0, 10);
}

/**
 * Get recent activity
 */
async function getRecentActivity(userId: string, isAdmin: boolean): Promise<ActivityItem[]> {
    const supabase = createAdminClient();
    const activities: ActivityItem[] = [];

    // Get recent payments
    let paymentQuery = supabase
        .from('payments')
        .select('id, client_email, amount, status, created_at, clients(name)')
        .order('created_at', { ascending: false })
        .limit(10);

    const { data: payments } = await paymentQuery;

    if (payments) {
        payments.forEach((p: any) => {
            activities.push({
                id: `payment-${p.id}`,
                type: 'payment',
                title: p.status === 'succeeded' ? 'Payment Received' : `Payment ${p.status}`,
                description: p.clients?.name || p.client_email || 'Unknown',
                timestamp: p.created_at,
                amount: p.amount, // Already in dollars
                status: p.status
            });
        });
    }

    // Sort by timestamp and limit
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return activities.slice(0, 5);
}
