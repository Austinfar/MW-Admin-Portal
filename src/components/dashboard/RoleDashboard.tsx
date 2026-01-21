'use client'

import { UserAccess } from '@/lib/auth-utils'
import { DashboardData } from '@/lib/actions/dashboard-data'
import {
    getDashboardLayout,
    getQuickActions,
    WIDGET_META,
    type WidgetId
} from '@/lib/dashboard-config'
import { TopRowGrid, MainContentGrid, MainArea, SidebarArea, TwoColumnGrid } from './DashboardGrid'
import { MetricWidget } from './widgets/base/WidgetCard'
import { RevenueChartWidget } from './widgets/admin/RevenueChartWidget'
import { AlertsWidget } from './widgets/admin/AlertsWidget'
import { CommissionSummaryWidget } from './widgets/admin/CommissionSummaryWidget'
import { FunnelWidget } from './widgets/sales/FunnelWidget'
import { RecentActivityWidget } from './widgets/common/RecentActivityWidget'
import { QuickActionsWidget } from './widgets/common/QuickActionsWidget'
import { formatCurrency } from '@/lib/utils'

interface RoleDashboardProps {
    userAccess: UserAccess
    data: DashboardData
}

export function RoleDashboard({ userAccess, data }: RoleDashboardProps) {
    const { role, permissions } = userAccess
    const jobTitle = userAccess.job_title || null

    // Get layout configuration for this role
    const layout = getDashboardLayout(role, jobTitle)
    const quickActions = getQuickActions(role, jobTitle)

    // Track delay for staggered animations
    let delayCounter = 0

    // Render a metric widget based on its ID
    const renderMetricWidget = (widgetId: WidgetId) => {
        const meta = WIDGET_META[widgetId]
        const delay = delayCounter++

        switch (widgetId) {
            case 'forecast':
                return data.businessMetrics ? (
                    <MetricWidget
                        key={widgetId}
                        title={meta.title}
                        value={formatCurrency(data.businessMetrics.forecastedRevenue)}
                        subtitle="CALENDAR YEAR PROJECTED"
                        icon={meta.icon}
                        iconColor={meta.iconColor}
                        delay={delay}
                    />
                ) : null

            case 'mrr':
                return data.businessMetrics ? (
                    <MetricWidget
                        key={widgetId}
                        title={meta.title}
                        value={formatCurrency(data.businessMetrics.mrr)}
                        subtitle="MONTHLY RECURRING REVENUE"
                        icon={meta.icon}
                        iconColor={meta.iconColor}
                        delay={delay}
                    />
                ) : null

            case 'active_clients':
                return (
                    <MetricWidget
                        key={widgetId}
                        title={meta.title}
                        value={data.clientStats?.active ?? data.businessMetrics?.activeClients ?? 0}
                        icon={meta.icon}
                        iconColor={meta.iconColor}
                        progress={70}
                        delay={delay}
                    />
                )

            case 'pending_commissions':
                return (
                    <MetricWidget
                        key={widgetId}
                        title={meta.title}
                        value={formatCurrency(
                            data.commissionSummary?.totalCommissionsPending ??
                            data.personalCommission?.pending ?? 0
                        )}
                        icon={meta.icon}
                        iconColor={meta.iconColor}
                        delay={delay}
                    />
                )

            case 'my_revenue':
                return (
                    <MetricWidget
                        key={widgetId}
                        title={meta.title}
                        value={formatCurrency(0)} // TODO: Implement personal revenue
                        subtitle="This Month"
                        icon={meta.icon}
                        iconColor={meta.iconColor}
                        delay={delay}
                    />
                )

            case 'deals_closed':
                return (
                    <MetricWidget
                        key={widgetId}
                        title={meta.title}
                        value={data.salesFunnel?.closed ?? 0}
                        subtitle="This Month"
                        icon={meta.icon}
                        iconColor={meta.iconColor}
                        delay={delay}
                    />
                )

            case 'close_rate':
                return (
                    <MetricWidget
                        key={widgetId}
                        title={meta.title}
                        value={`${(data.salesFunnel?.conversionRate ?? 0).toFixed(1)}%`}
                        icon={meta.icon}
                        iconColor={meta.iconColor}
                        progress={data.salesFunnel?.conversionRate ?? 0}
                        delay={delay}
                    />
                )

            case 'my_commission':
                return (
                    <MetricWidget
                        key={widgetId}
                        title={meta.title}
                        value={formatCurrency(data.personalCommission?.pending ?? 0)}
                        subtitle={`Paid: ${formatCurrency(data.personalCommission?.paidThisMonth ?? 0)}`}
                        icon={meta.icon}
                        iconColor={meta.iconColor}
                        gradient
                        delay={delay}
                    />
                )

            case 'bookings':
                return (
                    <MetricWidget
                        key={widgetId}
                        title={meta.title}
                        value={data.salesFunnel?.booked ?? 0}
                        subtitle="This Month"
                        icon={meta.icon}
                        iconColor={meta.iconColor}
                        delay={delay}
                    />
                )

            case 'shows':
                return (
                    <MetricWidget
                        key={widgetId}
                        title={meta.title}
                        value={data.salesFunnel?.showed ?? 0}
                        subtitle="This Month"
                        icon={meta.icon}
                        iconColor={meta.iconColor}
                        delay={delay}
                    />
                )

            case 'show_rate':
                const showRate = data.salesFunnel?.booked
                    ? ((data.salesFunnel.showed / data.salesFunnel.booked) * 100)
                    : 0
                return (
                    <MetricWidget
                        key={widgetId}
                        title={meta.title}
                        value={`${showRate.toFixed(1)}%`}
                        icon={meta.icon}
                        iconColor={meta.iconColor}
                        progress={showRate}
                        delay={delay}
                    />
                )

            case 'my_clients':
                return (
                    <MetricWidget
                        key={widgetId}
                        title={meta.title}
                        value={data.clientStats?.myClients ?? 0}
                        icon={meta.icon}
                        iconColor={meta.iconColor}
                        delay={delay}
                    />
                )

            case 'in_onboarding':
                return (
                    <MetricWidget
                        key={widgetId}
                        title={meta.title}
                        value={data.clientStats?.onboarding ?? 0}
                        icon={meta.icon}
                        iconColor={meta.iconColor}
                        delay={delay}
                    />
                )

            case 'onboarding_tasks':
                return (
                    <MetricWidget
                        key={widgetId}
                        title={meta.title}
                        value={data.onboardingStats?.pendingTasks ?? 0}
                        subtitle={`${data.onboardingStats?.overdueTasks ?? 0} overdue`}
                        icon={meta.icon}
                        iconColor={meta.iconColor}
                        delay={delay}
                    />
                )

            case 'failed_payments':
                return (
                    <MetricWidget
                        key={widgetId}
                        title={meta.title}
                        value={data.businessMetrics?.failedPayments.length ?? 0}
                        icon={meta.icon}
                        iconColor={meta.iconColor}
                        delay={delay}
                    />
                )

            case 'open_issues':
                return (
                    <MetricWidget
                        key={widgetId}
                        title={meta.title}
                        value={data.alerts?.length ?? 0}
                        icon={meta.icon}
                        iconColor={meta.iconColor}
                        delay={delay}
                    />
                )

            default:
                return null
        }
    }

    // Render main area widget
    const renderMainWidget = (widgetId: WidgetId) => {
        const delay = delayCounter++

        switch (widgetId) {
            case 'revenue_chart':
                return data.businessMetrics ? (
                    <RevenueChartWidget
                        key={widgetId}
                        monthlyRevenue={data.businessMetrics.monthlyRevenue}
                        delay={delay}
                    />
                ) : null

            case 'sales_funnel':
                return data.salesFunnel ? (
                    <FunnelWidget
                        key={widgetId}
                        funnel={data.salesFunnel}
                        delay={delay}
                    />
                ) : null

            case 'commission_summary':
                return data.commissionSummary ? (
                    <CommissionSummaryWidget
                        key={widgetId}
                        summary={data.commissionSummary}
                        delay={delay}
                    />
                ) : null

            // Placeholder for widgets not yet implemented
            case 'quota_progress':
            case 'next_call':
            case 'follow_up_tasks':
            case 'leads_to_work':
            case 'upcoming_calls':
            case 'client_stats':
            case 'onboarding_overview':
            case 'client_activity':
            case 'onboarding_board':
                return (
                    <div
                        key={widgetId}
                        className="bg-card/40 border border-dashed border-primary/20 rounded-lg p-6 flex items-center justify-center"
                    >
                        <span className="text-muted-foreground text-sm">
                            {WIDGET_META[widgetId]?.title || widgetId} - Coming Soon
                        </span>
                    </div>
                )

            default:
                return null
        }
    }

    // Render sidebar widget
    const renderSidebarWidget = (widgetId: WidgetId) => {
        const delay = delayCounter++

        switch (widgetId) {
            case 'alerts':
                return data.alerts ? (
                    <AlertsWidget
                        key={widgetId}
                        alerts={data.alerts}
                        delay={delay}
                    />
                ) : null

            case 'recent_activity':
                return data.recentActivity ? (
                    <RecentActivityWidget
                        key={widgetId}
                        activities={data.recentActivity}
                        delay={delay}
                    />
                ) : null

            case 'quick_actions':
                return (
                    <QuickActionsWidget
                        key={widgetId}
                        actions={quickActions}
                        delay={delay}
                    />
                )

            // Placeholder for widgets not yet implemented
            case 'closer_leaderboard':
            case 'setter_leaderboard':
            case 'my_tasks':
                return (
                    <div
                        key={widgetId}
                        className="bg-card/40 border border-dashed border-primary/20 rounded-lg p-6 flex items-center justify-center"
                    >
                        <span className="text-muted-foreground text-sm">
                            {WIDGET_META[widgetId]?.title || widgetId} - Coming Soon
                        </span>
                    </div>
                )

            default:
                return null
        }
    }

    return (
        <div className="flex-1 space-y-6">
            {/* Top Row - Metric Cards */}
            <TopRowGrid>
                {layout.topRow.map(widgetId => renderMetricWidget(widgetId))}
            </TopRowGrid>

            {/* Main Content Grid */}
            <MainContentGrid>
                {/* Main Area (2/3 width) */}
                <MainArea>
                    {/* First widget takes full width if it's a chart */}
                    {layout.mainArea[0] === 'revenue_chart' && renderMainWidget(layout.mainArea[0])}

                    {/* Remaining main widgets in 2-column grid */}
                    {layout.mainArea.length > 1 && (
                        <TwoColumnGrid>
                            {layout.mainArea.slice(
                                layout.mainArea[0] === 'revenue_chart' ? 1 : 0
                            ).map(widgetId => renderMainWidget(widgetId))}
                        </TwoColumnGrid>
                    )}

                    {/* If no revenue chart, render all in grid */}
                    {layout.mainArea[0] !== 'revenue_chart' && layout.mainArea.length === 1 && (
                        renderMainWidget(layout.mainArea[0])
                    )}
                </MainArea>

                {/* Sidebar (1/3 width) */}
                <SidebarArea>
                    {layout.sidebar.map(widgetId => renderSidebarWidget(widgetId))}
                </SidebarArea>
            </MainContentGrid>
        </div>
    )
}
