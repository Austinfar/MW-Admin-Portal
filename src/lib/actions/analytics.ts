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
};

async function _getBusinessMetrics(): Promise<BusinessMetrics> {
    // Use Admin Client for global metrics to allow caching independent of user session
    // This ensures one cache entry serves all admins
    const supabase = createAdminClient();

    // 1. Fetch all successful payments
    const { data: payments, error: paymentsError } = await supabase
        .from('payments')
        .select('*')
        .eq('status', 'succeeded')
        .order('created_at', { ascending: false });

    if (paymentsError) {
        console.error('Error fetching payments:', paymentsError);
        throw new Error('Failed to fetch payments');
    }

    // 2. Fetch all active clients
    const { count: activeClients, error: clientsError } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

    if (clientsError) {
        console.error('Error fetching active clients:', clientsError);
    }

    const allPayments = (payments as Payment[]) || [];

    // 3. Calculate KPI Metrics
    const totalRevenue = allPayments.reduce((sum, p) => sum + p.amount, 0) / 100; // Cents to Dollars
    const averagePayment = allPayments.length > 0 ? totalRevenue / allPayments.length : 0;

    // 4. Calculate Monthly Revenue for Chart
    // Group by "Month Year" (e.g., "Jan 2024")
    const revenueByMonth: Record<string, number> = {};

    // Initialize last 6 months to 0 to ensure chart continuity
    for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const key = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }); // "Jan 2024"
        revenueByMonth[key] = 0;
    }

    allPayments.forEach(payment => {
        const date = new Date(payment.created_at);
        const key = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        if (revenueByMonth[key] !== undefined) {
            revenueByMonth[key] += payment.amount / 100;
        }
    });

    const monthlyRevenue = Object.entries(revenueByMonth).map(([name, total]) => ({
        name,
        total
    }));

    // 5. Recent Payments (Last 5)
    const recentPayments = allPayments.slice(0, 5);

    return {
        totalRevenue,
        activeClients: activeClients || 0,
        averagePayment,
        recentPayments,
        monthlyRevenue
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
