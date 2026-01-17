'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { unstable_cache } from 'next/cache';
import { Payment } from '@/types/payment';

export type BusinessMetrics = {
    totalRevenue: number;
    activeClients: number;
    averagePayment: number;
    recentPayments: Payment[];
    monthlyRevenue: { name: string; total: number }[];
    mrr: number; // Monthly Recurring Revenue
    activeSubscriptions: number;
    churnedSubscriptions: number; // Last 30 days
    forecastedRevenue: number; // 2026 Year Forecast
    failedPayments: Payment[];
};

async function _getBusinessMetrics(): Promise<BusinessMetrics> {
    // Use Admin Client for global metrics to allow caching independent of user session
    const supabase = createAdminClient();

    // 1. Fetch All Payments (succeeded, failed, pending)
    // specific ordering for recent list
    const { data: payments, error: paymentsError } = await supabase
        .from('payments')
        .select('*, clients(name)')
        .order('payment_date', { ascending: false });

    if (paymentsError) {
        console.error('Error fetching payments:', paymentsError);
        throw new Error('Failed to fetch payments');
    }

    const allPayments = (payments as Payment[]) || [];

    // 2. Fetch Active Clients
    const { count: activeClients, error: clientsError } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

    if (clientsError) {
        console.error('Error fetching active clients:', clientsError);
    }

    // 3. Calculate Total Revenue & Avg Payment (Only Succeeded)
    const succeededPayments = allPayments.filter(p => p.status === 'succeeded');

    // Assuming standard Stripe cents for 'amount' column
    const totalRevenue = succeededPayments.reduce((sum, p) => sum + p.amount, 0);
    const averagePayment = succeededPayments.length > 0 ? totalRevenue / succeededPayments.length : 0;

    // 4. Monthly Revenue Analysis (Last 12 Months)
    const monthlyRevenueMap = new Map<string, number>();

    // Initialize buckets (YYYY-MM to sort correctly, then map to Name)
    for (let i = 0; i < 12; i++) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const key = d.toISOString().slice(0, 7); // 2026-01
        monthlyRevenueMap.set(key, 0);
    }

    succeededPayments.forEach(p => {
        const d = new Date(p.payment_date || p.created_at);
        const key = d.toISOString().slice(0, 7);
        if (monthlyRevenueMap.has(key)) {
            monthlyRevenueMap.set(key, (monthlyRevenueMap.get(key) || 0) + p.amount);
        }
    });


    // Convert to array
    const monthlyRevenue = Array.from(monthlyRevenueMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0])) // Sort by date key
        .map(([key, total]) => {
            // Convert key 2026-01 to "Jan 2026" or just "Jan"
            const [year, month] = key.split('-');
            const dateObj = new Date(parseInt(year), parseInt(month) - 1);
            return {
                name: dateObj.toLocaleString('default', { month: 'short' }),
                total
            };
        });

    // 5. Subscription Metrics
    const { data: subscriptions } = await supabase
        .from('subscriptions')
        .select('*');

    const allSubs = subscriptions || [];
    const activeSubs = allSubs.filter(s => s.status === 'active' || s.status === 'trialing');
    const activeSubscriptions = activeSubs.length;

    let mrr = 0;
    activeSubs.forEach(sub => {
        let amount = sub.amount / 100; // Cents to Dollars
        if (sub.interval === 'year') {
            amount = amount / 12;
        }
        mrr += amount;
    });

    // Churn (Last 30 Days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const churnedSubscriptions = allSubs.filter(s =>
        s.status === 'canceled' &&
        new Date(s.updated_at || s.created_at) > thirtyDaysAgo
    ).length;

    // 6. Forecast 2026 (Calendar Year)
    // Formula: Actual Verified 2026 Rev + Projected Revenue for Remainder
    // Projection: Start from current MRR, grow by CMGR for remaining months

    // Calculate CMGR from last 6 months of data
    // Use the raw sorted map entries before name conversion for accuracy? 
    // We can use `monthlyRevenue` array since it is sorted by time (Jan -> Dec)
    const last6Months = monthlyRevenue.slice(-6);
    let cmgr = 0;
    if (last6Months.length >= 2) {
        const start = last6Months[0].total;
        const end = last6Months[last6Months.length - 1].total;
        if (start > 0 && end > 0) {
            const n = last6Months.length - 1;
            cmgr = Math.pow(end / start, 1 / n) - 1;
        }
    }
    // Cap CMGR: Floor at -50%, Cap at +20% monthly to avoid explosions
    const safeCmgr = Math.max(-0.5, Math.min(cmgr, 0.20));

    const targetYear = 2026;
    const currentYear = new Date().getFullYear(); // in simulation: 2026

    // Actual Verified 2026 Revenue
    const actualRevenue2026 = succeededPayments
        .filter(p => {
            const d = new Date(p.payment_date || p.created_at);
            return d.getFullYear() === targetYear;
        })
        .reduce((sum, p) => sum + p.amount, 0); // Amount is already in Dollars

    let projectedFutureRevenue = 0;

    // Only project if we are in (or before) the target year
    if (currentYear <= targetYear) {
        let simulatedMrr = mrr;
        const now = new Date();
        const currentMonthIndex = (currentYear === targetYear) ? now.getMonth() : -1;
        // Index: Jan=0. 
        // Remaining full months: (11 - currentMonthIndex)
        // e.g. if Jan(0), remaining = 11 (Feb..Dec)

        const monthsRemaining = 11 - currentMonthIndex;

        for (let i = 1; i <= monthsRemaining; i++) {
            simulatedMrr = simulatedMrr * (1 + safeCmgr);
            projectedFutureRevenue += simulatedMrr;
        }
    }

    const forecastedRevenue = actualRevenue2026 + projectedFutureRevenue;

    // 7. Recent & Failed Payments
    const recentPayments = allPayments.slice(0, 5); // Returns full Payment objects (mixed status)

    const failedPayments = allPayments
        .filter(p => p.status !== 'succeeded' && p.status !== 'pending')
        .slice(0, 5);

    return {
        totalRevenue,
        activeClients: activeClients || 0,
        averagePayment,
        recentPayments, // This allows the UI to show status badges (failed/succeeded)
        monthlyRevenue,
        mrr,
        activeSubscriptions,
        churnedSubscriptions,
        forecastedRevenue,
        failedPayments
    };
}

export const getBusinessMetrics = unstable_cache(
    _getBusinessMetrics,
    ['business-metrics'],
    {
        revalidate: 300, // 5 minutes
        tags: ['business_metrics', 'dashboard']
    }
);
