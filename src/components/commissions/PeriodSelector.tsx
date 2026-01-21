'use client'

import { useState, useMemo } from 'react'
import { format, subDays } from 'date-fns'
import { ChevronDown, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export interface PayPeriod {
    start: Date
    end: Date
    payoutDate: Date
    label: string
    isCurrent: boolean
}

interface PeriodSelectorProps {
    selectedPeriod: PayPeriod | null
    onPeriodChange: (period: PayPeriod) => void
    className?: string
}

/**
 * Generate pay periods (bi-weekly, Monday-Sunday, anchored to Dec 16, 2024)
 */
function generatePayPeriods(count: number = 12): PayPeriod[] {
    const anchor = new Date('2024-12-16T00:00:00Z')
    const now = new Date()
    const diffTime = now.getTime() - anchor.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    const currentPeriodIndex = Math.floor(diffDays / 14)

    const periods: PayPeriod[] = []

    // Generate periods from current going back
    for (let i = 0; i < count; i++) {
        const periodIndex = currentPeriodIndex - i
        const periodStart = new Date(anchor)
        periodStart.setDate(anchor.getDate() + (periodIndex * 14))

        const periodEnd = new Date(periodStart)
        periodEnd.setDate(periodEnd.getDate() + 13)

        // Payout is Friday after period ends
        const payoutDate = new Date(periodEnd)
        const dayOfWeek = payoutDate.getDay()
        const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7
        payoutDate.setDate(payoutDate.getDate() + daysUntilFriday)

        const isCurrent = i === 0

        periods.push({
            start: periodStart,
            end: periodEnd,
            payoutDate,
            label: `${format(periodStart, 'MMM d')} - ${format(periodEnd, 'MMM d, yyyy')}`,
            isCurrent
        })
    }

    return periods
}

export function PeriodSelector({ selectedPeriod, onPeriodChange, className }: PeriodSelectorProps) {
    const periods = useMemo(() => generatePayPeriods(12), [])

    // Default to current period if none selected
    const displayPeriod = selectedPeriod || periods[0]

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="outline"
                    className={cn(
                        "w-[280px] justify-start text-left font-normal bg-white/5 border-white/10 hover:bg-white/10",
                        className
                    )}
                >
                    <Calendar className="mr-2 h-4 w-4" />
                    <span className="flex-1">{displayPeriod.label}</span>
                    {displayPeriod.isCurrent && (
                        <span className="ml-2 text-xs bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded">
                            Current
                        </span>
                    )}
                    <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[280px]" align="start">
                {periods.map((period, index) => (
                    <DropdownMenuItem
                        key={index}
                        onClick={() => onPeriodChange(period)}
                        className={cn(
                            "flex items-center justify-between cursor-pointer",
                            selectedPeriod?.start.getTime() === period.start.getTime() && "bg-white/10"
                        )}
                    >
                        <span>{period.label}</span>
                        {period.isCurrent && (
                            <span className="text-xs bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded">
                                Current
                            </span>
                        )}
                    </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    Showing last 12 pay periods
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

export { generatePayPeriods }
