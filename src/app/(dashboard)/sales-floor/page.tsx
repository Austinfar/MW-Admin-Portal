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
import { SalesFloorClient } from '@/components/sales/floor/SalesFloorClient'
import { protectRoute } from '@/lib/protect-route'
import { getCurrentUserProfile } from '@/lib/actions/profile'

export const dynamic = 'force-dynamic' // Ensure real-time data

export default async function SalesFloorPage() {
    await protectRoute('can_view_sales_floor')

    // Get current user for personalization
    const userProfile = await getCurrentUserProfile()
    const userId = userProfile?.id || ''

    // Fetch all data in parallel
    const [
        dashboardData,
        nextZoom,
        upcomingCalls,
        closerStats,
        setterStats,
        closerLeaderboard,
        setterLeaderboard,
        followUpTasks,
    ] = await Promise.all([
        getSalesDashboardData(),
        getNextZoom(userId),
        getUpcomingCalls(48),
        userId ? getCloserStats(userId, 'month') : null,
        userId ? getSetterStats(userId, 'month') : null,
        getCloserLeaderboard('month', userId),
        getSetterLeaderboard('month', userId),
        userId ? getFollowUpTasks(userId) : [],
    ])

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
        />
    )
}
