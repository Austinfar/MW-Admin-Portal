import { getSalesDashboardData } from '@/lib/actions/sales-dashboard'
import {
    getNextZoom,
    getUpcomingCalls,
    getCloserStats,
    getSetterStats,
    getCloserLeaderboard,
    getSetterLeaderboard,
    getFollowUpTasks,
} from '@/lib/actions/sales-floor'
import { getRecentSalesCalls } from '@/lib/actions/sales'
import { SalesFloorClient } from '@/components/sales/floor/SalesFloorClient'
import { protectRoute } from '@/lib/protect-route'
import { getCurrentUserProfile } from '@/lib/actions/profile'

export const dynamic = 'force-dynamic' // Ensure real-time data

export default async function SalesFloorPage() {
    await protectRoute('can_view_sales_floor')

    // Get current user for personalization
    const userProfile = await getCurrentUserProfile()
    const userId = userProfile?.id || ''

    // Fetch all data in parallel with timing
    const startTime = Date.now();
    console.log('[SalesFloor] Starting data fetch...');

    const [
        dashboardData,
        nextZoom,
        upcomingCalls,
        closerStats,
        setterStats,
        closerLeaderboard,
        setterLeaderboard,
        followUpTasks,
        recentAnalyzedCalls,
    ] = await Promise.all([
        getSalesDashboardData().then(r => { console.log(`[SalesFloor] dashboardData: ${Date.now() - startTime}ms`); return r; }),
        getNextZoom(userId).then(r => { console.log(`[SalesFloor] nextZoom: ${Date.now() - startTime}ms`); return r; }),
        getUpcomingCalls(48).then(r => { console.log(`[SalesFloor] upcomingCalls: ${Date.now() - startTime}ms`); return r; }),
        (userId ? getCloserStats(userId, 'month') : Promise.resolve(null)).then(r => { console.log(`[SalesFloor] closerStats: ${Date.now() - startTime}ms`); return r; }),
        (userId ? getSetterStats(userId, 'month') : Promise.resolve(null)).then(r => { console.log(`[SalesFloor] setterStats: ${Date.now() - startTime}ms`); return r; }),
        getCloserLeaderboard('month', userId).then(r => { console.log(`[SalesFloor] closerLeaderboard: ${Date.now() - startTime}ms`); return r; }),
        getSetterLeaderboard('month', userId).then(r => { console.log(`[SalesFloor] setterLeaderboard: ${Date.now() - startTime}ms`); return r; }),
        (userId ? getFollowUpTasks(userId) : Promise.resolve([])).then(r => { console.log(`[SalesFloor] followUpTasks: ${Date.now() - startTime}ms`); return r; }),
        getRecentSalesCalls(3).then(r => { console.log(`[SalesFloor] recentCalls: ${Date.now() - startTime}ms`); return r; }),
    ])

    console.log(`[SalesFloor] Total fetch time: ${Date.now() - startTime}ms`);

    return (
        <SalesFloorClient
            userId={userId}
            userJobTitle={null}
            ticker={dashboardData.ticker}
            funnel={dashboardData.funnel}
            streaks={dashboardData.streaks}
            legacyLeaderboard={dashboardData.leaderboard}
            nextZoom={nextZoom}
            upcomingCalls={upcomingCalls}
            closerStats={closerStats}
            setterStats={setterStats}
            closerLeaderboard={closerLeaderboard}
            setterLeaderboard={setterLeaderboard}
            followUpTasks={followUpTasks}
            recentAnalyzedCalls={recentAnalyzedCalls}
        />
    )
}
