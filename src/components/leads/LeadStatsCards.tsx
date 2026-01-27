'use client'

import { Users, Star, Calendar, Clock } from 'lucide-react'
import { MetricWidget } from '@/components/dashboard/widgets/base/WidgetCard'
import { LeadStats } from '@/types/lead'

interface LeadStatsCardsProps {
    stats: LeadStats
}

export function LeadStatsCards({ stats }: LeadStatsCardsProps) {
    return (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <MetricWidget
                title="Total Leads"
                value={stats.total}
                icon={Users}
                iconColor="text-blue-500"
                subtitle="Active in pipeline"
                delay={0}
            />
            <MetricWidget
                title="Priority Leads"
                value={stats.priority}
                icon={Star}
                iconColor={stats.priority > 0 ? "text-yellow-500" : "text-muted-foreground"}
                subtitle={stats.priority > 0 ? "Flagged as hot" : "No priority leads"}
                delay={1}
            />
            <MetricWidget
                title="Appts Booked"
                value={stats.booked}
                icon={Calendar}
                iconColor="text-purple-500"
                subtitle={`${stats.bookingRate}% booking rate`}
                delay={2}
            />
            <MetricWidget
                title="Awaiting Follow-up"
                value={stats.awaitingFollowUp}
                icon={Clock}
                iconColor={stats.awaitingFollowUp > 0 ? "text-amber-500" : "text-muted-foreground"}
                subtitle={stats.awaitingFollowUp > 0 ? "Need attention" : "All caught up"}
                delay={3}
            />
        </div>
    )
}
