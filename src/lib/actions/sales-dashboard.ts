'use server';

import { stripe } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import { calClient } from '@/lib/cal/client';
import { startOfDay, endOfDay, subDays, startOfMonth, startOfWeek, subMonths } from 'date-fns';

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

        // 1. Fetch Stripe Data (Revenue & Wins)
        // Fetching charges helps us see actual captured money
        // We limit to 100 for performance, ideally we'd paginate if high volume
        const charges = await stripe.charges.list({
            limit: 100,
            created: { gte: Math.floor(fromDate.getTime() / 1000) }, // Last 30 days
            expand: ['data.payment_intent']
        });

        // 2. Fetch Cal.com Data (Bookings)
        // Fetch upcoming and recent past bookings
        const bookings = await calClient.getBookings(startOfMonthDate, endOfDay(now));

        // 3. Fetch Supabase Data (Sales Logs / Showed)
        // using Admin Client to ensure we see all team data
        const supabase = createAdminClient();
        const { data: salesLogs } = await supabase
            .from('sales_call_logs')
            .select('id, created_at, submitted_by, status')
            .gte('created_at', startOfMonthDate.toISOString());


        // --- PROCESSSING DATA ---

        // A. Ticker Feed (Mixed Stream)
        const tickerItems: TickerItem[] = [];

        // Add recent sales to ticker
        charges.data.forEach(charge => {
            if (charge.status === 'succeeded' && charge.amount > 0) {
                // Try to get name from metadata, fallback to 'Team Member'
                const closerName = charge.metadata?.salesCloserId || 'Sales Team'; // In future map ID to Name
                const amount = (charge.amount / 100).toLocaleString('en-US', { style: 'currency', currency: charge.currency });

                tickerItems.push({
                    id: charge.id,
                    type: 'sale',
                    message: `🔥 ${amount} deal closed!`, // Simplified for now
                    timestamp: new Date(charge.created * 1000).toISOString()
                });
            }
        });

        // Add bookings to ticker
        bookings.forEach(booking => {
            if (booking.status === 'ACCEPTED') {
                tickerItems.push({
                    id: String(booking.id),
                    type: 'booking',
                    message: `📅 New Meeting: ${booking.title}`,
                    timestamp: booking.startTime || new Date().toISOString() // Use startTime since CalBooking doesn't have createdAt
                });
            }
        });

        // Sort ticker by newest first
        tickerItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());


        // B. Leaderboard (Revenue & Volume)
        // Group by Sales Closer (using metadata.salesCloserId)
        // NOTE: We rely on `salesCloserId` being present on Stripe metadata.
        // For now, if missing, we might group under "Unattributed". 
        // Real-world: We would map ID -> User Name from DB.
        const leaderboardMap = new Map<string, LeaderboardItem>();

        charges.data.forEach(charge => {
            if (charge.status === 'succeeded') {
                const closerId = charge.metadata?.salesCloserName || charge.metadata?.salesCloserId || 'Unassigned'; // Fallback to ID/Unassigned
                const current = leaderboardMap.get(closerId) || { id: closerId, name: closerId, revenue: 0, deals: 0, calls: 0, winRate: 0 };

                current.revenue += charge.amount / 100;
                current.deals += 1;
                leaderboardMap.set(closerId, current);
            }
        });

        // Add Calls count from Cal.com (matching attendee or user)
        // This is tricky if Cal.com email doesn't match Stripe ID. 
        // For MVP, we'll try to match by email if possible, or just skip if we can't link.
        // Assuming 'Unassigned' captures most manual volume for now.

        // Convert to array and sort by Revenue
        let leaderboard = Array.from(leaderboardMap.values());
        leaderboard.sort((a, b) => b.revenue - a.revenue);


        // C. Funnel (Aggregate)
        // Booked: Cal.com accepted bookings in range
        // Showed: Sales Logs created (implying a meeting happened)
        // Closed: Stripe Charges (Wins)

        const funnel: FunnelData = {
            booked: bookings.filter(b => b.status === 'ACCEPTED').length,
            showed: salesLogs?.length || 0,
            closed: charges.data.filter(c => c.status === 'succeeded').length
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
