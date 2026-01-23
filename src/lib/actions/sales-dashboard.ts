'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { calClient } from '@/lib/cal/client';
import { endOfDay, subDays, startOfMonth } from 'date-fns';

export interface DashboardData {
    ticker: TickerItem[];
    leaderboard: LeaderboardItem[];
    funnel: FunnelData;
    streaks: StreakItem[];
}

export interface TickerItem {
    id: string;
    type: 'sale' | 'booking';
    message: string;
    timestamp: string;
}

export interface LeaderboardItem {
    id: string; // salesCloserId or user email if filtering by email
    name: string;
    revenue: number;
    deals: number;
    calls: number;
    winRate: number;
}

export interface FunnelData {
    booked: number; // Cal.com
    showed: number; // Analyzed Logs
    closed: number; // Stripe Charge
}

export interface StreakItem {
    name: string;
    days: number;
}


export async function getSalesDashboardData(): Promise<DashboardData> {
    const now = new Date();
    const startOfMonthDate = startOfMonth(now);
    const fromDate = subDays(now, 30); // Look back 30 days for general data context

    try {
        console.log('[SalesDashboard] Fetching data...');

        const supabase = createAdminClient();

        // 1. Fetch payments from database (much faster than Stripe API)
        const { data: payments } = await supabase
            .from('payments')
            .select('id, amount, currency, payment_date, client_id, product_name, clients(sold_by_user_id, name)')
            .eq('status', 'succeeded')
            .gte('payment_date', fromDate.toISOString())
            .order('payment_date', { ascending: false })
            .limit(100);

        // 2. Fetch Cal.com Data (Bookings) - still need external API for this
        const bookings = await calClient.getBookings(startOfMonthDate, endOfDay(now));

        // 3. Fetch Supabase Data (Sales Logs / Showed)
        const { data: salesLogs } = await supabase
            .from('sales_call_logs')
            .select('id, created_at, submitted_by, status')
            .gte('created_at', startOfMonthDate.toISOString());


        // --- PROCESSSING DATA ---

        // A. Ticker Feed (Today Only)
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        // Pre-fetch user names for both Ticker and Leaderboard
        const closerIds = [...new Set((payments || []).map(p => (p.clients as any)?.sold_by_user_id).filter(Boolean))];
        const { data: closerUsers } = await supabase
            .from('users')
            .select('id, name')
            .in('id', closerIds.length > 0 ? closerIds : ['none']);

        const userNameMap = new Map((closerUsers || []).map(u => [u.id, u.name]));

        const tickerItems: TickerItem[] = [];

        // Add today's payments to ticker
        (payments || []).forEach(payment => {
            const paymentDate = new Date(payment.payment_date);

            // Filter: Must be today AND not a recurring subscription update
            // We want to see: "Subscription creation" (New MRR), or normal payments (PIF/Splits)
            const productName = payment.product_name || '';
            const isRecurringUpdate = productName === 'Subscription update';

            if (paymentDate >= startOfToday && !isRecurringUpdate) {
                const amount = Number(payment.amount).toLocaleString('en-US', { style: 'currency', currency: payment.currency || 'usd' });

                // Determine details
                const closerId = (payment.clients as any)?.sold_by_user_id;
                const closerName = userNameMap.get(closerId) || 'Team Member';
                const clientName = (payment.clients as any)?.name || 'Client';

                // Determine Concept (MRR vs Split vs PIF)
                let typeLabel = 'Pay in Full';
                const lowerName = productName.toLowerCase();
                if (productName === 'Subscription creation') {
                    typeLabel = 'Monthly Recurring';
                } else if (lowerName.includes('1/2') || lowerName.includes('split') || lowerName.includes('deposit')) {
                    typeLabel = 'Split Payment';
                }

                tickerItems.push({
                    id: payment.id,
                    type: 'sale',
                    // Format: "Sarah Gleason closed John Doe for $500.00 (Pay in Full)"
                    message: `${closerName} closed ${clientName} for ${amount} (${typeLabel})`,
                    timestamp: payment.payment_date
                });
            }
        });

        // Add today's bookings to ticker
        bookings.forEach(booking => {
            // Check if booking is today
            const bookingTime = new Date(booking.startTime);
            if (booking.status === 'ACCEPTED' && bookingTime >= startOfToday && bookingTime < endOfDay(now)) {
                tickerItems.push({
                    id: String(booking.id),
                    type: 'booking',
                    message: `📅 New Meeting: ${booking.title}`,
                    timestamp: booking.startTime
                });
            }
        });

        // Sort ticker by newest first (though strictly for carousel it might not matter much)
        tickerItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());


        // B. Leaderboard (Revenue & Volume)
        // Group by Sales Closer using clients.sold_by_user_id
        const leaderboardMap = new Map<string, LeaderboardItem>();

        // (User fetching logic moved up to be shared with Ticker)

        (payments || []).forEach(payment => {
            const closerId = (payment.clients as any)?.sold_by_user_id || 'Unassigned';
            const closerName = userNameMap.get(closerId) || closerId;
            const current = leaderboardMap.get(closerId) || { id: closerId, name: closerName, revenue: 0, deals: 0, calls: 0, winRate: 0 };

            current.revenue += Number(payment.amount);
            current.deals += 1;
            leaderboardMap.set(closerId, current);
        });

        // Convert to array and sort by Revenue
        let leaderboard = Array.from(leaderboardMap.values());
        leaderboard.sort((a, b) => b.revenue - a.revenue);


        // C. Funnel (Aggregate)
        // Booked: Cal.com accepted bookings in range
        // Showed: Sales Logs created (implying a meeting happened)
        // Closed: Payments (from database)

        const funnel: FunnelData = {
            booked: bookings.filter(b => b.status === 'ACCEPTED').length,
            showed: salesLogs?.length || 0,
            closed: (payments || []).length
        };


        // D. Streaks (Dummy logic for now until we have consistent daily data)
        // We look for consecutive days with >0 sales
        const streaks: StreakItem[] = [
            { name: 'Austin', days: 3 }, // Placeholder
            { name: 'Team', days: 5 }
        ];


        return {
            ticker: tickerItems,
            leaderboard,
            funnel,
            streaks
        };

    } catch (error) {
        console.error('Error in getSalesDashboardData:', error);
        // Return skeletons/empty to avoid page crash
        return {
            ticker: [],
            leaderboard: [],
            funnel: { booked: 0, showed: 0, closed: 0 },
            streaks: []
        };
    }
}
