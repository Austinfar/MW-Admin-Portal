'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { format } from 'date-fns'
import {
    DollarSign,
    Calendar,
    CheckCircle,
    Clock,
    XCircle,
    AlertCircle,
    Edit2,
    ChevronDown,
    ChevronUp
} from 'lucide-react'
import type { PaymentScheduleSummary, ScheduledCharge } from '@/types/subscription'

interface PaymentScheduleCardProps {
    clientId: string
    schedule: PaymentScheduleSummary | null
    canEdit: boolean
}

const CHARGE_STATUS_CONFIG: Record<string, { icon: React.ElementType; className: string }> = {
    pending: { icon: Clock, className: 'text-amber-500' },
    paid: { icon: CheckCircle, className: 'text-emerald-500' },
    failed: { icon: XCircle, className: 'text-red-500' },
    cancelled: { icon: AlertCircle, className: 'text-gray-500' },
}

export function PaymentScheduleCard({
    clientId,
    schedule,
    canEdit
}: PaymentScheduleCardProps) {
    const [expanded, setExpanded] = useState(false)

    if (!schedule || schedule.schedules.length === 0) {
        return (
            <Card className="bg-card/50 backdrop-blur-xl border-white/5 hover:border-primary/20 transition-all duration-300 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-base">Payment Schedule</CardTitle>
                    <div className="p-2 rounded-full bg-muted/50 shrink-0">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </div>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">No payment schedule found.</p>
                </CardContent>
            </Card>
        )
    }

    const { totalValue, totalPaid, totalRemaining } = schedule
    const progressPercent = totalValue > 0 ? (totalPaid / totalValue) * 100 : 0

    // Get all scheduled charges across all schedules
    const allCharges: (ScheduledCharge & { scheduleName: string })[] = []
    for (const sched of schedule.schedules) {
        for (const charge of sched.scheduled_charges || []) {
            allCharges.push({
                ...charge,
                scheduleName: sched.plan_name || 'Payment Plan'
            })
        }
    }

    // Sort by due date
    allCharges.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())

    // Separate pending and completed
    const pendingCharges = allCharges.filter(c => c.status === 'pending')
    const completedCharges = allCharges.filter(c => c.status !== 'pending')

    return (
        <Card className="bg-card/50 backdrop-blur-xl border-white/5 hover:border-primary/20 transition-all duration-300 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base">Payment Schedule</CardTitle>
                <div className="p-2 rounded-full bg-emerald-500/10 shrink-0">
                    <DollarSign className="h-4 w-4 text-emerald-500" />
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Summary */}
                <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Total Program Value</span>
                        <span className="text-sm font-medium">
                            {new Intl.NumberFormat('en-US', {
                                style: 'currency',
                                currency: 'USD'
                            }).format(totalValue / 100)}
                        </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Collected</span>
                            <span className="text-emerald-500 font-medium">
                                {new Intl.NumberFormat('en-US', {
                                    style: 'currency',
                                    currency: 'USD'
                                }).format(totalPaid / 100)}
                            </span>
                        </div>
                        <Progress value={progressPercent} className="h-2" />
                        <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Remaining</span>
                            <span className="text-amber-500 font-medium">
                                {new Intl.NumberFormat('en-US', {
                                    style: 'currency',
                                    currency: 'USD'
                                }).format(totalRemaining / 100)}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Upcoming Payments */}
                {pendingCharges.length > 0 && (
                    <div className="border-t border-white/5 pt-3 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Upcoming Payments
                            </span>
                            <Badge variant="outline" className="text-xs">
                                {pendingCharges.length} remaining
                            </Badge>
                        </div>

                        <div className="space-y-2 max-h-[150px] overflow-y-auto scrollbar-thin">
                            {pendingCharges.slice(0, expanded ? undefined : 3).map((charge) => {
                                const StatusIcon = CHARGE_STATUS_CONFIG[charge.status]?.icon || Clock
                                const statusClass = CHARGE_STATUS_CONFIG[charge.status]?.className || 'text-muted-foreground'
                                const isPastDue = new Date(charge.due_date) < new Date()

                                return (
                                    <div
                                        key={charge.id}
                                        className="flex items-center justify-between p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                                    >
                                        <div className="flex items-center gap-2">
                                            <StatusIcon className={`h-3.5 w-3.5 ${statusClass}`} />
                                            <div>
                                                <div className="text-sm font-medium">
                                                    {new Intl.NumberFormat('en-US', {
                                                        style: 'currency',
                                                        currency: 'USD'
                                                    }).format(charge.amount / 100)}
                                                </div>
                                                <div className={`text-xs ${isPastDue ? 'text-red-500' : 'text-muted-foreground'}`}>
                                                    <Calendar className="h-3 w-3 inline mr-1" />
                                                    {format(new Date(charge.due_date), 'MMM d, yyyy')}
                                                    {isPastDue && ' (Past due)'}
                                                </div>
                                            </div>
                                        </div>
                                        {canEdit && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 w-7 p-0 hover:bg-white/10"
                                            >
                                                <Edit2 className="h-3 w-3" />
                                            </Button>
                                        )}
                                    </div>
                                )
                            })}
                        </div>

                        {pendingCharges.length > 3 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="w-full text-xs"
                                onClick={() => setExpanded(!expanded)}
                            >
                                {expanded ? (
                                    <>
                                        <ChevronUp className="h-3 w-3 mr-1" />
                                        Show Less
                                    </>
                                ) : (
                                    <>
                                        <ChevronDown className="h-3 w-3 mr-1" />
                                        Show {pendingCharges.length - 3} More
                                    </>
                                )}
                            </Button>
                        )}
                    </div>
                )}

                {/* Completed Payments Summary */}
                {completedCharges.length > 0 && (
                    <div className="text-xs text-muted-foreground border-t border-white/5 pt-2">
                        <CheckCircle className="h-3 w-3 inline mr-1 text-emerald-500" />
                        {completedCharges.length} payment{completedCharges.length !== 1 ? 's' : ''} completed
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
