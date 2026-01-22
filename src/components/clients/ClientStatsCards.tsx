'use client'

import { Users, UserCheck, AlertTriangle, CalendarClock } from 'lucide-react'
import { MetricWidget } from '@/components/dashboard/widgets/base/WidgetCard'
import { ClientStats } from '@/types/client'

interface ClientStatsCardsProps {
    stats: ClientStats
}

export function ClientStatsCards({ stats }: ClientStatsCardsProps) {
    return (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <MetricWidget
                title="Total Clients"
                value={stats.total}
                icon={Users}
                iconColor="text-blue-500"
                delay={0}
            />
            <MetricWidget
                title="Active Clients"
                value={stats.active}
                icon={UserCheck}
                iconColor="text-emerald-500"
                subtitle={stats.total > 0 ? `${Math.round((stats.active / stats.total) * 100)}% of total` : undefined}
                delay={1}
            />
            <MetricWidget
                title="At Risk"
                value={stats.atRisk}
                icon={AlertTriangle}
                iconColor={stats.atRisk > 0 ? "text-amber-500" : "text-muted-foreground"}
                subtitle={stats.atRisk > 0 ? "Payment or onboarding issues" : "No clients at risk"}
                delay={2}
            />
            <MetricWidget
                title="Ending Soon"
                value={stats.endingSoon}
                icon={CalendarClock}
                iconColor={stats.endingSoon > 0 ? "text-orange-500" : "text-muted-foreground"}
                subtitle={stats.endingSoon > 0 ? "Contracts ending in 30 days" : "No contracts ending soon"}
                delay={3}
            />
        </div>
    )
}
