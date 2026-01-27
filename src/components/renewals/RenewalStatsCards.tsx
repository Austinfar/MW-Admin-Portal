'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, Clock, CalendarCheck, XCircle, CheckCircle } from 'lucide-react'

interface RenewalStatsCardsProps {
    stats: {
        totalExpiring30Days: number
        critical: number
        urgent: number
        upcoming: number
        renewed: number
        churned: number
    }
}

export function RenewalStatsCards({ stats }: RenewalStatsCardsProps) {
    const cards = [
        {
            title: 'Critical',
            value: stats.critical,
            description: '≤7 days',
            icon: AlertTriangle,
            color: 'text-red-500',
            bgColor: 'bg-red-500/10',
        },
        {
            title: 'Urgent',
            value: stats.urgent,
            description: '8-14 days',
            icon: Clock,
            color: 'text-orange-500',
            bgColor: 'bg-orange-500/10',
        },
        {
            title: 'Upcoming',
            value: stats.upcoming,
            description: '15-30 days',
            icon: CalendarCheck,
            color: 'text-yellow-500',
            bgColor: 'bg-yellow-500/10',
        },
        {
            title: 'Renewed',
            value: stats.renewed,
            description: 'This period',
            icon: CheckCircle,
            color: 'text-green-500',
            bgColor: 'bg-green-500/10',
        },
        {
            title: 'Churned',
            value: stats.churned,
            description: 'This period',
            icon: XCircle,
            color: 'text-gray-500',
            bgColor: 'bg-gray-500/10',
        },
    ]

    return (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            {cards.map((card) => {
                const Icon = card.icon
                return (
                    <Card
                        key={card.title}
                        className="bg-card/50 backdrop-blur-xl border-white/5 hover:border-primary/20 transition-all duration-300"
                    >
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                {card.title}
                            </CardTitle>
                            <div className={`p-2 rounded-full ${card.bgColor}`}>
                                <Icon className={`h-4 w-4 ${card.color}`} />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className={`text-2xl font-bold ${card.color}`}>
                                {card.value}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                {card.description}
                            </p>
                        </CardContent>
                    </Card>
                )
            })}
        </div>
    )
}
