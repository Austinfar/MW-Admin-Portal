'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { Loader2, ChevronUp, Star } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

import { getFeatureRequests } from '@/lib/actions/feature-requests'
import {
    TYPE_CONFIG,
    CATEGORY_CONFIG,
    type FeatureRequest,
} from '@/types/roadmap'

export function ChangelogView() {
    const [completedRequests, setCompletedRequests] = useState<FeatureRequest[]>([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        loadCompleted()
    }, [])

    const loadCompleted = async () => {
        setIsLoading(true)
        try {
            const result = await getFeatureRequests(
                { status: 'completed' },
                { field: 'updated_at', direction: 'desc' },
                { page: 1, limit: 50 }
            )
            setCompletedRequests(result.data)
        } catch (error) {
            console.error('Error loading changelog:', error)
        } finally {
            setIsLoading(false)
        }
    }

    if (isLoading) {
        return (
            <div className="flex justify-center items-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (completedRequests.length === 0) {
        return (
            <div className="text-center py-20 text-muted-foreground">
                <Star className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <h3 className="text-lg font-medium mb-2">No completed features yet</h3>
                <p className="text-sm">Completed features will appear here with release notes.</p>
            </div>
        )
    }

    // Group by month
    const groupedByMonth: Record<string, FeatureRequest[]> = {}
    completedRequests.forEach((request) => {
        const monthKey = format(new Date(request.completed_at || request.updated_at), 'MMMM yyyy')
        if (!groupedByMonth[monthKey]) {
            groupedByMonth[monthKey] = []
        }
        groupedByMonth[monthKey].push(request)
    })

    return (
        <div className="space-y-8 max-w-3xl mx-auto">
            {Object.entries(groupedByMonth).map(([month, requests]) => (
                <div key={month}>
                    <h2 className="text-xl font-semibold mb-4 sticky top-0 bg-background py-2 z-10">
                        {month}
                    </h2>
                    <div className="space-y-4">
                        {requests.map((request) => (
                            <ChangelogItem key={request.id} request={request} />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    )
}

function ChangelogItem({ request }: { request: FeatureRequest }) {
    const typeConfig = TYPE_CONFIG[request.type]
    const categoryConfig = CATEGORY_CONFIG[request.category]

    return (
        <Card className="overflow-hidden">
            <CardContent className="p-6">
                <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className="text-3xl flex-shrink-0">
                        {typeConfig.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h3 className="text-lg font-semibold mb-1">
                                    {request.title}
                                </h3>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                                    <Badge variant="secondary" className="text-xs">
                                        {categoryConfig.icon} {categoryConfig.label}
                                    </Badge>
                                    <span>•</span>
                                    <span>
                                        Completed {request.completed_at
                                            ? format(new Date(request.completed_at), 'MMM d, yyyy')
                                            : format(new Date(request.updated_at), 'MMM d, yyyy')}
                                    </span>
                                </div>
                            </div>

                            {/* Vote count */}
                            <div className="flex items-center gap-1 text-muted-foreground">
                                <ChevronUp className="h-4 w-4" />
                                <span className="text-sm font-medium">{request.vote_count}</span>
                            </div>
                        </div>

                        {/* Release Notes or Description */}
                        {request.release_notes ? (
                            <div className="prose prose-sm dark:prose-invert max-w-none">
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                    {request.release_notes}
                                </p>
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                                {request.description?.replace(/[#*`]/g, '').slice(0, 200)}
                            </p>
                        )}

                        {/* Submitter Credit */}
                        <div className="flex items-center gap-2 mt-4 pt-3 border-t">
                            <Avatar className="h-5 w-5">
                                <AvatarImage src={request.submitter?.avatar_url || undefined} />
                                <AvatarFallback className="text-[10px]">
                                    {request.submitter?.name?.charAt(0) || '?'}
                                </AvatarFallback>
                            </Avatar>
                            <span className="text-xs text-muted-foreground">
                                Requested by <span className="font-medium text-foreground">{request.submitter?.name || 'Unknown'}</span>
                            </span>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
