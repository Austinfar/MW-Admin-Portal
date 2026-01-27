'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calendar, Clock, Video, ExternalLink, XCircle, Loader2 } from 'lucide-react'
import { format, formatDistanceToNow, isPast, isToday, isTomorrow, differenceInHours } from 'date-fns'
import { markLeadNoShow } from '@/lib/actions/lead-actions'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface ConsultationInfoCardProps {
    consultationDate: string | null
    meetingLink?: string | null
    leadId: string
    status: string
    onStatusChange?: () => void
}

export function ConsultationInfoCard({
    consultationDate,
    meetingLink,
    leadId,
    status,
    onStatusChange
}: ConsultationInfoCardProps) {
    const [isMarkingNoShow, setIsMarkingNoShow] = useState(false)

    const handleMarkNoShow = async () => {
        if (!confirm('Mark this lead as No Show? This will change their status.')) return

        setIsMarkingNoShow(true)
        const result = await markLeadNoShow(leadId)
        if (result.error) {
            toast.error(result.error)
        } else {
            toast.success('Lead marked as No Show')
            onStatusChange?.()
        }
        setIsMarkingNoShow(false)
    }

    if (!consultationDate) {
        return (
            <Card className="bg-zinc-900/60 border-zinc-800">
                <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-zinc-800 rounded-full">
                            <Calendar className="h-5 w-5 text-zinc-500" />
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-medium text-zinc-400">No Consultation Scheduled</p>
                            <p className="text-xs text-zinc-500">Lead has not booked a call yet</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        )
    }

    const date = new Date(consultationDate)
    const isOverdue = isPast(date) && !['Closed Won', 'Closed Lost', 'No Show', 'Won', 'Lost'].includes(status)
    const isUpcomingToday = isToday(date) && !isPast(date)
    const isUpcomingTomorrow = isTomorrow(date)
    const hoursUntil = differenceInHours(date, new Date())

    // Determine card color
    let cardBg = 'bg-zinc-900/60 border-zinc-800'
    let iconBg = 'bg-blue-500/10'
    let iconColor = 'text-blue-500'
    let statusText = ''

    if (isOverdue) {
        cardBg = 'bg-red-950/30 border-red-900/50'
        iconBg = 'bg-red-500/10'
        iconColor = 'text-red-500'
        statusText = 'Overdue'
    } else if (isUpcomingToday) {
        cardBg = 'bg-amber-950/30 border-amber-900/50'
        iconBg = 'bg-amber-500/10'
        iconColor = 'text-amber-500'
        statusText = hoursUntil <= 1 ? 'Starting soon!' : `In ${hoursUntil} hours`
    } else if (isUpcomingTomorrow) {
        cardBg = 'bg-green-950/30 border-green-900/50'
        iconBg = 'bg-green-500/10'
        iconColor = 'text-green-500'
        statusText = 'Tomorrow'
    } else if (!isPast(date)) {
        cardBg = 'bg-blue-950/20 border-blue-900/30'
        statusText = formatDistanceToNow(date, { addSuffix: true })
    } else {
        // Past but status is Won/Lost/No Show
        cardBg = 'bg-zinc-900/60 border-zinc-800'
        iconBg = 'bg-zinc-500/10'
        iconColor = 'text-zinc-500'
        statusText = 'Completed'
    }

    return (
        <Card className={cn('transition-all', cardBg)}>
            <CardContent className="p-4">
                <div className="flex items-start gap-3">
                    <div className={cn('p-2 rounded-full', iconBg)}>
                        <Calendar className={cn('h-5 w-5', iconColor)} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-medium text-white">
                                {format(date, 'EEEE, MMMM d')}
                            </p>
                            {statusText && (
                                <span className={cn(
                                    'text-xs px-2 py-0.5 rounded-full',
                                    isOverdue ? 'bg-red-500/20 text-red-400' :
                                        isUpcomingToday ? 'bg-amber-500/20 text-amber-400' :
                                            isUpcomingTomorrow ? 'bg-green-500/20 text-green-400' :
                                                'bg-zinc-500/20 text-zinc-400'
                                )}>
                                    {statusText}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-1 text-zinc-400">
                            <Clock className="h-3 w-3" />
                            <span className="text-sm">{format(date, 'h:mm a')}</span>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-4">
                    {meetingLink && !isPast(date) && (
                        <Button
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                            asChild
                        >
                            <a href={meetingLink} target="_blank" rel="noopener noreferrer">
                                <Video className="mr-1.5 h-3.5 w-3.5" />
                                Join Call
                            </a>
                        </Button>
                    )}

                    {!isPast(date) && (
                        <Button
                            size="sm"
                            variant="outline"
                            className="border-zinc-700 hover:bg-zinc-800"
                            asChild
                        >
                            <a href="https://cal.com" target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                                Reschedule
                            </a>
                        </Button>
                    )}

                    {isOverdue && status !== 'No Show' && (
                        <Button
                            size="sm"
                            variant="destructive"
                            onClick={handleMarkNoShow}
                            disabled={isMarkingNoShow}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            {isMarkingNoShow ? (
                                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <XCircle className="mr-1.5 h-3.5 w-3.5" />
                            )}
                            Mark No Show
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
