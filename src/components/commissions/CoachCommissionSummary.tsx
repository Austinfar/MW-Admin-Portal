'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getCurrentPeriodStats } from '@/lib/actions/payroll'
import { formatCurrency, cn } from '@/lib/utils'
import { Loader2, DollarSign, Clock, TrendingUp, Calendar } from 'lucide-react'
import { format } from 'date-fns'

interface PeriodStats {
    currentPeriod: { start: Date; end: Date; payoutDate: Date }
    earned: number
    pending: number
    adjustments: number
    yearToDate: number
}

interface CoachCommissionSummaryProps {
    coachId?: string
    className?: string
}

export function CoachCommissionSummary({ coachId, className }: CoachCommissionSummaryProps) {
    const [stats, setStats] = useState<PeriodStats | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchStats() {
            try {
                const data = await getCurrentPeriodStats(coachId)
                setStats(data)
            } catch (error) {
                console.error('Failed to fetch period stats:', error)
            } finally {
                setLoading(false)
            }
        }
        fetchStats()
    }, [coachId])

    if (loading) {
        return (
            <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4", className)}>
                {[1, 2, 3, 4].map(i => (
                    <Card key={i} className="bg-card/40 border-white/5 backdrop-blur-sm">
                        <CardContent className="flex items-center justify-center h-24">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </CardContent>
                    </Card>
                ))}
            </div>
        )
    }

    if (!stats) return null

    const cards = [
        {
            title: 'Current Period',
            subtitle: stats.currentPeriod
                ? `${format(stats.currentPeriod.start, 'MMM d')} - ${format(stats.currentPeriod.end, 'MMM d')}`
                : 'N/A',
            value: stats.earned,
            icon: DollarSign,
            color: 'emerald',
            description: 'Earned this period'
        },
        {
            title: 'Pending Payout',
            subtitle: stats.currentPeriod
                ? `Payout: ${format(stats.currentPeriod.payoutDate, 'MMM d')}`
                : 'N/A',
            value: stats.pending,
            icon: Clock,
            color: 'yellow',
            description: 'Awaiting next payroll'
        },
        {
            title: 'Adjustments',
            subtitle: stats.adjustments >= 0 ? 'Bonuses' : 'Deductions',
            value: stats.adjustments,
            icon: TrendingUp,
            color: stats.adjustments >= 0 ? 'blue' : 'red',
            description: 'Pending adjustments'
        },
        {
            title: 'Year to Date',
            subtitle: new Date().getFullYear().toString(),
            value: stats.yearToDate,
            icon: Calendar,
            color: 'purple',
            description: 'Total paid this year'
        }
    ]

    const colorClasses: Record<string, string> = {
        emerald: 'text-emerald-500',
        yellow: 'text-yellow-500',
        blue: 'text-blue-500',
        red: 'text-red-500',
        purple: 'text-purple-500'
    }

    const iconBgClasses: Record<string, string> = {
        emerald: 'bg-emerald-500/10',
        yellow: 'bg-yellow-500/10',
        blue: 'bg-blue-500/10',
        red: 'bg-red-500/10',
        purple: 'bg-purple-500/10'
    }

    return (
        <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4", className)}>
            {cards.map((card, index) => {
                const Icon = card.icon
                return (
                    <Card key={index} className="bg-card/40 border-white/5 backdrop-blur-sm hover:bg-card/60 transition-colors">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <div>
                                <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                                <p className="text-xs text-muted-foreground">{card.subtitle}</p>
                            </div>
                            <div className={cn("p-2 rounded-lg", iconBgClasses[card.color])}>
                                <Icon className={cn("h-4 w-4", colorClasses[card.color])} />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className={cn("text-2xl font-bold", colorClasses[card.color])}>
                                {card.value < 0 && '-'}
                                {formatCurrency(Math.abs(card.value))}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">{card.description}</p>
                        </CardContent>
                    </Card>
                )
            })}
        </div>
    )
}
