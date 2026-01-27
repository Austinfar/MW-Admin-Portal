'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
    format,
    startOfMonth,
    endOfMonth,
    eachDayOfInterval,
    isSameMonth,
    isSameDay,
    addMonths,
    subMonths,
    parseISO,
    getDay,
} from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover'
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RenewalCalendarEvent } from '@/types/contract'

interface RenewalsCalendarProps {
    clients: RenewalCalendarEvent[]
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function getUrgencyColor(days: number): string {
    if (days < 0) return 'bg-red-500'
    if (days <= 7) return 'bg-red-500'
    if (days <= 14) return 'bg-orange-500'
    if (days <= 30) return 'bg-yellow-500'
    return 'bg-gray-500'
}

export function RenewalsCalendar({ clients }: RenewalsCalendarProps) {
    const [currentMonth, setCurrentMonth] = useState(new Date())

    // Group clients by their end date
    const clientsByDate = useMemo(() => {
        const map = new Map<string, RenewalCalendarEvent[]>()
        clients.forEach(client => {
            const dateKey = client.contractEndDate
            if (!map.has(dateKey)) {
                map.set(dateKey, [])
            }
            map.get(dateKey)!.push(client)
        })
        return map
    }, [clients])

    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd })

    // Get the starting day of the week for padding
    const startingDayOfWeek = getDay(monthStart)

    const goToPreviousMonth = () => setCurrentMonth(subMonths(currentMonth, 1))
    const goToNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))
    const goToToday = () => setCurrentMonth(new Date())

    return (
        <Card className="bg-card/50 backdrop-blur-xl border-white/5">
            <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">
                        {format(currentMonth, 'MMMM yyyy')}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={goToToday}
                        >
                            Today
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={goToPreviousMonth}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={goToNextMonth}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {/* Weekday headers */}
                <div className="grid grid-cols-7 mb-2">
                    {WEEKDAYS.map(day => (
                        <div
                            key={day}
                            className="text-center text-sm font-medium text-muted-foreground py-2"
                        >
                            {day}
                        </div>
                    ))}
                </div>

                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-px bg-white/5 rounded-lg overflow-hidden">
                    {/* Empty cells for padding */}
                    {Array.from({ length: startingDayOfWeek }).map((_, i) => (
                        <div
                            key={`empty-${i}`}
                            className="min-h-[100px] bg-card/30 p-2"
                        />
                    ))}

                    {/* Day cells */}
                    {days.map(day => {
                        const dateKey = format(day, 'yyyy-MM-dd')
                        const dayClients = clientsByDate.get(dateKey) || []
                        const isToday = isSameDay(day, new Date())
                        const isCurrentMonth = isSameMonth(day, currentMonth)

                        return (
                            <div
                                key={dateKey}
                                className={cn(
                                    'min-h-[100px] bg-card/50 p-2 transition-colors',
                                    !isCurrentMonth && 'bg-card/20',
                                    isToday && 'ring-1 ring-primary'
                                )}
                            >
                                <div className={cn(
                                    'text-sm font-medium mb-1',
                                    isToday && 'text-primary',
                                    !isCurrentMonth && 'text-muted-foreground/50'
                                )}>
                                    {format(day, 'd')}
                                </div>

                                {/* Client indicators */}
                                <div className="space-y-1">
                                    {dayClients.slice(0, 3).map(client => (
                                        <Popover key={client.contractId}>
                                            <PopoverTrigger asChild>
                                                <button
                                                    className={cn(
                                                        'w-full text-left text-xs px-1.5 py-0.5 rounded truncate',
                                                        getUrgencyColor(client.daysUntilExpiration),
                                                        'text-white hover:opacity-80 transition-opacity'
                                                    )}
                                                >
                                                    {client.clientName}
                                                </button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-64 p-3" align="start">
                                                <div className="space-y-2">
                                                    <div className="font-medium">{client.clientName}</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {client.clientEmail}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs">
                                                        <span className="text-muted-foreground">Program:</span>
                                                        <span>{client.programName}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs">
                                                        <span className="text-muted-foreground">Coach:</span>
                                                        <span>{client.coachName || 'Unassigned'}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs">
                                                        <span className="text-muted-foreground">Ends:</span>
                                                        <span>{format(parseISO(client.contractEndDate), 'MMM d, yyyy')}</span>
                                                    </div>
                                                    <Badge
                                                        variant={client.daysUntilExpiration <= 7 ? 'destructive' : 'secondary'}
                                                        className="text-xs"
                                                    >
                                                        {client.daysUntilExpiration < 0
                                                            ? `Expired ${Math.abs(client.daysUntilExpiration)}d ago`
                                                            : `${client.daysUntilExpiration}d left`}
                                                    </Badge>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="w-full mt-2"
                                                        asChild
                                                    >
                                                        <Link href={`/clients/${client.clientId}`}>
                                                            <ExternalLink className="mr-2 h-3 w-3" />
                                                            View Client
                                                        </Link>
                                                    </Button>
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    ))}
                                    {dayClients.length > 3 && (
                                        <div className="text-xs text-muted-foreground pl-1">
                                            +{dayClients.length - 3} more
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* Legend */}
                <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/5">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <div className="w-3 h-3 rounded bg-red-500" />
                        <span>Critical (≤7d)</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <div className="w-3 h-3 rounded bg-orange-500" />
                        <span>Urgent (8-14d)</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <div className="w-3 h-3 rounded bg-yellow-500" />
                        <span>Upcoming (15-30d)</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
