'use client'

import { CommissionReportItem } from '@/lib/actions/reports'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { format } from 'date-fns'

interface WeeklyReportProps {
    data: CommissionReportItem[]
    currentDate: Date
}

export function WeeklyReport({ data, currentDate }: WeeklyReportProps) {
    if (data.length === 0) {
        return (
            <div className="text-center py-10 border border-dashed rounded-lg">
                <p className="text-muted-foreground">No commissions recorded for this week.</p>
            </div>
        )
    }

    // Group by coach - count splits per coach
    const coachSplits: Record<string, { count: number; totalPercentage: number }> = {}
    data.forEach(item => {
        const coachName = item.coach?.name || 'Unknown'
        if (!coachSplits[coachName]) {
            coachSplits[coachName] = { count: 0, totalPercentage: 0 }
        }
        coachSplits[coachName].count += 1
        coachSplits[coachName].totalPercentage += Number(item.split_percentage)
    })

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {/* Summary Cards */}
                {Object.entries(coachSplits).map(([coachName, stats]) => (
                    <Card key={coachName} className="bg-card/50 backdrop-blur-sm border-primary/10">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                {coachName}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-card-foreground">
                                {stats.count} splits
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Avg: {(stats.totalPercentage / stats.count).toFixed(1)}%
                            </p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Card className="bg-card/40 border-primary/5">
                <CardHeader>
                    <CardTitle className="text-card-foreground">Commission Splits ({format(currentDate, 'MMM d')} Week)</CardTitle>
                    <CardDescription className="text-muted-foreground">Individual split records.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {data.map((item) => (
                            <div key={item.id} className="flex items-center justify-between border-b border-border/50 pb-4 last:border-0 last:pb-0">
                                <div className="space-y-1">
                                    <p className="font-medium text-sm text-foreground">{item.coach?.name || 'Unknown'}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {item.role_in_sale.toUpperCase().replace('_', ' ')} for {item.client?.name || 'Unknown Client'}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="font-medium text-sm text-foreground">
                                        {item.split_percentage}%
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {item.notes || 'No notes'}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
