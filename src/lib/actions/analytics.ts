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

    // Database stores amounts in dollars (converted from Stripe cents during sync)
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
            // Amounts already in dollars
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
        // Only count active subscriptions towards MRR, exclude trialing
        if (sub.status !== 'active') return;

        // Strict Monthly MRR: ONLY count subscriptions that bill exactly every 1 month.
        // Exclude Year (12 month) and Multi-Month (e.g. 6 month) plans
        if (sub.interval === 'month' && (!sub.interval_count || sub.interval_count === 1)) {
            mrr += sub.amount;
        }
    });

    // Churn (Last 30 Days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const churnedSubscriptions = allSubs.filter(s =>
        s.status === 'canceled' &&
        new Date(s.updated_at || s.created_at) > thirtyDaysAgo
    ).length;

    // 6. Forecast 2026 (Advanced Dynamic Model)
    // Formula: (Projected MRR) + (Projected One-Off Sales * Seasonality)

    // A. Seasonality Index (Fitness Industry Standard)
    // Jan/Feb peak, Q4 dip. 1.0 = Average.
    const seasonalityIndex = [
        1.25, 1.20, 1.15, // Q1 (High)
        1.10, 1.05, 1.00, // Q2 (Moderate)
        0.95, 0.90, 0.95, // Q3 (Summer Dip/Recovery)
        0.90, 0.80, 0.75  // Q4 (Holiday Dip)
    ];

    // B. Calculate One-Off Sales Momentum (Weighted Average of Last 3 Months)
    // We need to separate "Recurring" payment volume from "One-Off" volume in the last 3 months
    // Since we don't have a perfect tag, we'll approximate: 
    // Total Revenue of Month - (Start of Month MRR). 
    // Or simpler: Use the `monthlyRevenue` array and subtract the *average* MRR of that period.
    // For specific accuracy, let's just use the Total Monthly Revenue trend, as it captures both.

    // Get last 3 months of revenue (most recent last)
    const recentMonths = monthlyRevenue.slice(-3);
    let momentumBase = 0;

    if (recentMonths.length > 0) {
        if (recentMonths.length === 1) {
            momentumBase = recentMonths[0].total;
        } else if (recentMonths.length === 2) {
            momentumBase = (recentMonths[1].total * 0.6) + (recentMonths[0].total * 0.4);
        } else {
            // 50% Last Month, 30% Month-2, 20% Month-3
            momentumBase = (recentMonths[2].total * 0.5) + (recentMonths[1].total * 0.3) + (recentMonths[0].total * 0.2);
        }
    }

    // Determine Organic Growth Rate (CMGR) - Same capped logic as before but applied to the Momentum Base
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
    const safeCmgr = Math.max(-0.20, Math.min(cmgr, 0.08)); // Cap at 8% monthly growth

    const targetYear = 2026;
    const currentYear = new Date().getFullYear();

    // Actual Verified 2026 Revenue (Banked)
    const actualRevenue2026 = succeededPayments
        .filter(p => {
            const d = new Date(p.payment_date || p.created_at);
            return d.getFullYear() === targetYear;
        })
        .reduce((sum, p) => sum + p.amount, 0);

    let projectedFutureRevenue = 0;

    if (currentYear <= targetYear) {
        let currentBase = momentumBase || mrr; // Fallback to MRR if no history
        const now = new Date();
        const currentMonthIndex = (currentYear === targetYear) ? now.getMonth() : -1;

        // Project remaining months
        const monthsRemaining = 11 - currentMonthIndex;

        for (let i = 1; i <= monthsRemaining; i++) {
            // Apply Growth
            currentBase = currentBase * (1 + safeCmgr);

            // Apply Seasonality
            const futureMonthIndex = (currentMonthIndex + i) % 12;
            const seasonalFactor = seasonalityIndex[futureMonthIndex];

            projectedFutureRevenue += (currentBase * seasonalFactor);
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
