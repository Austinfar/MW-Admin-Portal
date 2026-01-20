'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
    BarChart3,
    TrendingUp,
    TrendingDown,
    Users,
    MessageSquare,
    ChevronUp,
    Clock,
    CheckCircle2,
    XCircle,
    Zap,
} from 'lucide-react'

import { getAdminAnalytics } from '@/lib/actions/feature-requests'
import type { RoadmapStats } from '@/types/roadmap'

interface AnalyticsData {
    requestsByCategory: { category: string; count: number }[]
    requestsByType: { type: string; count: number }[]
    requestsByStatus: { status: string; count: number }[]
    topVoted: { id: string; title: string; vote_count: number }[]
    recentActivity: { id: string; title: string; action: string; timestamp: string }[]
    totalVotes: number
    totalComments: number
    avgTimeToReview: number
    avgTimeToComplete: number
    completionRate: number
}

interface AnalyticsDashboardProps {
    stats: RoadmapStats
}

export function AnalyticsDashboard({ stats }: AnalyticsDashboardProps) {
    const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const fetchAnalytics = async () => {
            try {
                const data = await getAdminAnalytics()
                setAnalytics(data)
            } catch (error) {
                console.error('Failed to fetch analytics:', error)
            } finally {
                setIsLoading(false)
            }
        }
        fetchAnalytics()
    }, [])

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-neon-green" />
                <h3 className="font-semibold text-lg">Analytics Dashboard</h3>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard
                    label="Total Requests"
                    value={stats.total}
                    icon={<Zap className="h-5 w-5" />}
                    color="neon"
                />
                <MetricCard
                    label="Total Votes"
                    value={analytics?.totalVotes ?? 0}
                    icon={<ChevronUp className="h-5 w-5" />}
                    color="blue"
                />
                <MetricCard
                    label="Comments"
                    value={analytics?.totalComments ?? 0}
                    icon={<MessageSquare className="h-5 w-5" />}
                    color="purple"
                />
                <MetricCard
                    label="Completion Rate"
                    value={`${analytics?.completionRate ?? 0}%`}
                    icon={<CheckCircle2 className="h-5 w-5" />}
                    color="emerald"
                    isPercentage
                />
            </div>

            {/* Status Distribution */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base">Status Distribution</CardTitle>
                    <CardDescription>Requests by current status</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        <StatusBar label="Submitted" value={stats.submitted} total={stats.total} color="bg-zinc-400" />
                        <StatusBar label="Reviewing" value={stats.reviewing} total={stats.total} color="bg-blue-400" />
                        <StatusBar label="Planned" value={stats.planned} total={stats.total} color="bg-amber-400" />
                        <StatusBar label="In Progress" value={stats.in_progress} total={stats.total} color="bg-neon-green" />
                        <StatusBar label="Completed" value={stats.completed} total={stats.total} color="bg-emerald-400" />
                        <StatusBar label="Rejected" value={stats.rejected} total={stats.total} color="bg-red-400" />
                    </div>
                </CardContent>
            </Card>

            {/* Two Column Layout */}
            <div className="grid md:grid-cols-2 gap-6">
                {/* Top Voted */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-neon-green" />
                            Top Voted Requests
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <LoadingSkeleton rows={5} />
                        ) : analytics?.topVoted.length ? (
                            <div className="space-y-2">
                                {analytics.topVoted.map((request, index) => (
                                    <div
                                        key={request.id}
                                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50"
                                    >
                                        <span className="text-sm font-medium text-muted-foreground w-5">
                                            #{index + 1}
                                        </span>
                                        <div className="flex items-center gap-1.5 text-neon-green">
                                            <ChevronUp className="h-4 w-4" />
                                            <span className="font-medium">{request.vote_count}</span>
                                        </div>
                                        <span className="text-sm truncate flex-1">{request.title}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">No voted requests yet</p>
                        )}
                    </CardContent>
                </Card>

                {/* Category Breakdown */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">By Category</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <LoadingSkeleton rows={5} />
                        ) : analytics?.requestsByCategory.length ? (
                            <div className="space-y-2">
                                {analytics.requestsByCategory.map((cat) => (
                                    <div
                                        key={cat.category}
                                        className="flex items-center justify-between p-2 rounded-lg hover:bg-accent/50"
                                    >
                                        <Badge variant="outline" className="capitalize">
                                            {cat.category}
                                        </Badge>
                                        <span className="text-sm font-medium">{cat.count}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">No data available</p>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Performance Metrics */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Response Times
                    </CardTitle>
                    <CardDescription>Average time to process requests</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-4 rounded-lg bg-muted/50">
                            <p className="text-2xl font-bold text-blue-400">
                                {analytics?.avgTimeToReview ?? 0}d
                            </p>
                            <p className="text-xs text-muted-foreground">Avg. Time to Review</p>
                        </div>
                        <div className="text-center p-4 rounded-lg bg-muted/50">
                            <p className="text-2xl font-bold text-emerald-400">
                                {analytics?.avgTimeToComplete ?? 0}d
                            </p>
                            <p className="text-xs text-muted-foreground">Avg. Time to Complete</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

function MetricCard({
    label,
    value,
    icon,
    color,
    isPercentage,
}: {
    label: string
    value: number | string
    icon: React.ReactNode
    color: 'neon' | 'blue' | 'purple' | 'emerald'
    isPercentage?: boolean
}) {
    const colorClasses = {
        neon: 'text-neon-green bg-neon-green/10 border-neon-green/20',
        blue: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
        purple: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
        emerald: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
    }

    return (
        <Card className={`${colorClasses[color]} border`}>
            <CardContent className="py-4 px-4">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-2xl font-bold">{value}</p>
                        <p className="text-xs opacity-80">{label}</p>
                    </div>
                    <div className="opacity-60">{icon}</div>
                </div>
            </CardContent>
        </Card>
    )
}

function StatusBar({
    label,
    value,
    total,
    color,
}: {
    label: string
    value: number
    total: number
    color: string
}) {
    const percentage = total > 0 ? (value / total) * 100 : 0

    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium">{value}</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                    className={`h-full ${color} transition-all duration-500`}
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    )
}

function LoadingSkeleton({ rows }: { rows: number }) {
    return (
        <div className="space-y-2">
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="h-8 bg-muted/50 rounded animate-pulse" />
            ))}
        </div>
    )
}
