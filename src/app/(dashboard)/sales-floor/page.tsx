import { getSalesDashboardData } from '@/lib/actions/sales-dashboard'
import SalesCalendar from '@/components/sales/SalesCalendar'
import { LiveTicker } from '@/components/sales/floor/LiveTicker'
import { Leaderboard } from '@/components/sales/floor/Leaderboard'
import { PipelineFunnel } from '@/components/sales/floor/PipelineFunnel'
import { StreakCounter } from '@/components/sales/floor/StreakCounter'
import { WarRoom } from '@/components/sales/floor/WarRoom'

export const dynamic = 'force-dynamic' // Ensure real-time data

export default async function SalesFloorPage() {
    const dashboardData = await getSalesDashboardData()

    return (
        <div className="flex-1 flex flex-col min-h-screen bg-[#09090b] overflow-x-hidden">
            {/* Top Bar: Live Ticker */}
            <LiveTicker items={dashboardData.ticker} />

            <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight text-white mb-2">Sales Floor</h2>
                        <p className="text-muted-foreground">
                            Team availability, upcoming calls, and sales management.
                        </p>
                    </div>
                </div>

                {/* HUD Row: Quick Metrics & Tools */}
                {/* Removed fixed h-40 to prevent overlap on smaller screens */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="md:col-span-1">
                        <StreakCounter streaks={dashboardData.streaks} />
                    </div>
                    {/* Pipeline spans 2 cols on large screens, full width on mobile/tablet if needed */}
                    <div className="md:col-span-2">
                        <PipelineFunnel data={dashboardData.funnel} />
                    </div>
                    <div className="md:col-span-1">
                        <WarRoom />
                    </div>
                </div>

                {/* Main Content Grid */}
                {/* Removed fixed h-[800px]. Calendar needs min-height to render properly. */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
                    {/* Left: Calendar (2/3 width on large screens) */}
                    <div className="xl:col-span-2 border border-gray-800 rounded-xl overflow-hidden bg-[#1A1A1A] min-h-[700px]">
                        <SalesCalendar />
                    </div>

                    {/* Right: Leaderboard (1/3 width on large screens) */}
                    {/* Sticky positioning keeps it in view while scrolling calendar */}
                    <div className="xl:col-span-1 lg:sticky lg:top-4">
                        <Leaderboard data={dashboardData.leaderboard} />
                    </div>
                </div>
            </div>
        </div>
    )
}
