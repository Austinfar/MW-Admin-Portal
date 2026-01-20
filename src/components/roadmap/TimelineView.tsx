'use client'

import { useState, useEffect } from 'react'
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, isWithinInterval, addMonths, subMonths, isSameMonth } from 'date-fns'
import { ChevronLeft, ChevronRight, Calendar, Target, Clock, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

import { getFeatureRequests } from '@/lib/actions/feature-requests'
import { STATUS_CONFIG, PRIORITY_CONFIG, type FeatureRequest, type Milestone, type RequestStatus } from '@/types/roadmap'

interface TimelineViewProps {
    milestones: Milestone[]
    isSuperAdmin: boolean
}

export function TimelineView({ milestones, isSuperAdmin }: TimelineViewProps) {
    const [requests, setRequests] = useState<FeatureRequest[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [startDate, setStartDate] = useState(() => startOfMonth(new Date()))
    const [monthsToShow] = useState(6)

    // Fetch requests that are planned or in progress
    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true)
            try {
                const result = await getFeatureRequests(
                    { status: ['planned', 'in_progress'] as RequestStatus[] },
                    { field: 'priority_score', direction: 'desc' },
                    { page: 1, limit: 100 }
                )
                setRequests(result.data)
            } catch (error) {
                console.error('Error fetching timeline data:', error)
            } finally {
                setIsLoading(false)
            }
        }
        fetchData()
    }, [])

    const months = eachMonthOfInterval({
        start: startDate,
        end: addMonths(startDate, monthsToShow - 1),
    })

    const navigatePrev = () => setStartDate(prev => subMonths(prev, 3))
    const navigateNext = () => setStartDate(prev => addMonths(prev, 3))
    const navigateToday = () => setStartDate(startOfMonth(new Date()))

    // Group requests by target quarter or milestone
    const getRequestsForMonth = (monthDate: Date) => {
        return requests.filter(req => {
            // First check if request has a target quarter
            if (req.target_quarter) {
                const [year, quarter] = req.target_quarter.split('-Q')
                const quarterMonth = (parseInt(quarter) - 1) * 3
                const quarterDate = new Date(parseInt(year), quarterMonth, 1)
                return isSameMonth(monthDate, quarterDate)
            }

            // Then check milestone target date
            if (req.milestone?.target_date) {
                return isSameMonth(monthDate, new Date(req.milestone.target_date))
            }

            return false
        })
    }

    // Get milestones for a specific month
    const getMilestonesForMonth = (monthDate: Date) => {
        return milestones.filter(m =>
            m.target_date && isSameMonth(monthDate, new Date(m.target_date))
        )
    }

    const isCurrentMonth = (monthDate: Date) => isSameMonth(monthDate, new Date())

    return (
        <div className="space-y-4">
            {/* Timeline Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <h3 className="font-semibold">Timeline View</h3>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={navigatePrev}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={navigateToday}>
                        Today
                    </Button>
                    <Button variant="outline" size="icon" onClick={navigateNext}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                    <div className="h-3 w-3 rounded-full bg-amber-400" />
                    <span className="text-muted-foreground">Planned</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="h-3 w-3 rounded-full bg-neon-green" />
                    <span className="text-muted-foreground">In Progress</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <Target className="h-3 w-3 text-blue-400" />
                    <span className="text-muted-foreground">Milestone</span>
                </div>
            </div>

            {/* Timeline Grid */}
            {isLoading ? (
                <div className="flex justify-center py-12">
                    <Clock className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            ) : (
                <div className="grid grid-cols-6 gap-2">
                    {months.map((monthDate) => {
                        const monthRequests = getRequestsForMonth(monthDate)
                        const monthMilestones = getMilestonesForMonth(monthDate)
                        const isCurrent = isCurrentMonth(monthDate)

                        return (
                            <div key={monthDate.toISOString()} className="space-y-2">
                                {/* Month Header */}
                                <div className={cn(
                                    "text-center py-2 px-3 rounded-lg text-sm font-medium",
                                    isCurrent ? "bg-neon-green/20 text-neon-green" : "bg-muted/50"
                                )}>
                                    {format(monthDate, 'MMM yyyy')}
                                </div>

                                {/* Milestones */}
                                {monthMilestones.map((milestone) => (
                                    <div
                                        key={milestone.id}
                                        className="flex items-center gap-1.5 p-2 rounded-md bg-blue-500/10 border border-blue-500/30 text-xs"
                                    >
                                        <Target className="h-3 w-3 text-blue-400 flex-shrink-0" />
                                        <span className="truncate font-medium text-blue-400">
                                            {milestone.name}
                                        </span>
                                    </div>
                                ))}

                                {/* Requests */}
                                <div className="space-y-1.5 min-h-[200px]">
                                    {monthRequests.length === 0 && monthMilestones.length === 0 && (
                                        <div className="text-center py-8 text-muted-foreground text-xs">
                                            No items
                                        </div>
                                    )}

                                    {monthRequests.map((request) => (
                                        <TimelineCard key={request.id} request={request} />
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Empty State */}
            {!isLoading && requests.length === 0 && (
                <Card className="bg-muted/20">
                    <CardContent className="py-8 text-center">
                        <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                        <p className="text-muted-foreground">
                            No planned or in-progress items with target dates.
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                            {isSuperAdmin
                                ? "Assign target quarters or milestones to requests to see them here."
                                : "Check back later to see what's coming up!"}
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}

function TimelineCard({ request }: { request: FeatureRequest }) {
    const statusConfig = STATUS_CONFIG[request.status]
    const priorityConfig = PRIORITY_CONFIG[request.priority]

    return (
        <div className={cn(
            "p-2 rounded-md border text-xs transition-colors hover:border-primary/50 cursor-pointer",
            request.status === 'in_progress' ? "border-neon-green/30 bg-neon-green/5" : "border-amber-400/30 bg-amber-400/5"
        )}>
            <div className="flex items-start justify-between gap-1 mb-1">
                <span className="font-medium line-clamp-2 leading-tight">
                    {request.title}
                </span>
                <Badge
                    variant="outline"
                    className={cn("text-[10px] px-1 py-0 flex-shrink-0", statusConfig.color)}
                >
                    {request.status === 'in_progress' ? 'WIP' : 'Plan'}
                </Badge>
            </div>

            <div className="flex items-center gap-1.5 text-muted-foreground">
                {request.status === 'in_progress' ? (
                    <Clock className="h-3 w-3 text-neon-green" />
                ) : (
                    <Calendar className="h-3 w-3 text-amber-400" />
                )}
                <span className={cn("text-[10px]", priorityConfig.color)}>
                    {priorityConfig.label}
                </span>
                {request.vote_count > 0 && (
                    <>
                        <span className="text-muted-foreground">•</span>
                        <span>{request.vote_count} votes</span>
                    </>
                )}
            </div>
        </div>
    )
}
