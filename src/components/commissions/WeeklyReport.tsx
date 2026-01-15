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

    // Group by coach
    const coachTotals: Record<string, number> = {}
    data.forEach(item => {
        const coachName = item.coach?.name || 'Unknown'
        // Just summing amounts for now
        coachTotals[coachName] = (coachTotals[coachName] || 0) + Number(item.amount)
    })

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {/* Summary Cards */}
                {Object.entries(coachTotals).map(([coachName, total]) => (
                    <Card key={coachName} className="bg-card/50 backdrop-blur-sm border-primary/10">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                {coachName}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-card-foreground">
                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(total)}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Total Payout
                            </p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Card className="bg-card/40 border-primary/5">
                <CardHeader>
                    <CardTitle className="text-card-foreground">Commission Splits ({format(currentDate, 'MMM d')} Week)</CardTitle>
                    <CardDescription className="text-muted-foreground">Individual payout records.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {data.map((item) => (
                            <div key={item.id} className="flex items-center justify-between border-b border-border/50 pb-4 last:border-0 last:pb-0">
                                <div className="space-y-1">
                                    <p className="font-medium text-sm text-foreground">{item.coach?.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {item.role.toUpperCase()} split on payment from {item.payment?.client?.name || 'Unknown Client'}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="font-medium text-sm text-foreground">
                                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(item.amount)}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        Rate: {item.percentage}% of ${item.payment?.amount}
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
