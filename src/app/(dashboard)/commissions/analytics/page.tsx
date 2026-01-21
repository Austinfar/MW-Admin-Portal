import { CommissionAnalyticsDashboard } from '@/components/commissions/analytics/CommissionAnalyticsDashboard'
import { Separator } from '@/components/ui/separator'
import { protectRoute } from '@/lib/protect-route'

export default async function AnalyticsPage() {
    await protectRoute('can_view_commissions')

    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Commission Analytics</h2>
                    <p className="text-muted-foreground">
                        Comprehensive insights into commission performance, trends, and forecasts.
                    </p>
                </div>
            </div>

            <Separator />

            <CommissionAnalyticsDashboard />
        </div>
    )
}
