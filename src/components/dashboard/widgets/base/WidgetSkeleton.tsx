import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface WidgetSkeletonProps {
    className?: string
    // Variant determines the skeleton layout
    variant?: 'metric' | 'chart' | 'list' | 'compact'
}

export function WidgetSkeleton({ className, variant = 'metric' }: WidgetSkeletonProps) {
    return (
        <Card className={cn(
            'bg-card/50 backdrop-blur-sm border-primary/10',
            className
        )}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-8 rounded-full" />
            </CardHeader>
            <CardContent>
                {variant === 'metric' && <MetricSkeletonContent />}
                {variant === 'chart' && <ChartSkeletonContent />}
                {variant === 'list' && <ListSkeletonContent />}
                {variant === 'compact' && <CompactSkeletonContent />}
            </CardContent>
        </Card>
    )
}

function MetricSkeletonContent() {
    return (
        <>
            <div className="flex items-baseline justify-between">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-5 w-12 rounded-full" />
            </div>
            <Skeleton className="mt-4 h-1 w-full" />
        </>
    )
}

function ChartSkeletonContent() {
    return (
        <div className="h-[200px] flex items-end justify-between gap-2 pt-4">
            {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton
                    key={i}
                    className="flex-1"
                    style={{ height: `${Math.random() * 60 + 40}%` }}
                />
            ))}
        </div>
    )
}

function ListSkeletonContent() {
    return (
        <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between p-2">
                    <div className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="space-y-1.5">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-3 w-16" />
                        </div>
                    </div>
                    <Skeleton className="h-5 w-16" />
                </div>
            ))}
        </div>
    )
}

function CompactSkeletonContent() {
    return (
        <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-12" />
                </div>
            ))}
        </div>
    )
}

// Grid skeleton for the entire dashboard
export function DashboardSkeleton() {
    return (
        <div className="flex-1 space-y-6">
            {/* Welcome Message Skeleton */}
            <div className="hidden md:block space-y-2">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-64" />
            </div>

            {/* Top Row - 4 Metric Cards */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <WidgetSkeleton key={i} variant="metric" />
                ))}
            </div>

            {/* Main Content Area */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {/* Main Area (2 cols) */}
                <div className="col-span-2 space-y-6">
                    <WidgetSkeleton variant="chart" className="h-[350px]" />
                    <div className="grid gap-6 md:grid-cols-2">
                        <WidgetSkeleton variant="compact" />
                        <WidgetSkeleton variant="compact" />
                    </div>
                </div>

                {/* Sidebar (1 col) */}
                <div className="col-span-1 space-y-6">
                    <WidgetSkeleton variant="list" />
                    <WidgetSkeleton variant="compact" />
                </div>
            </div>
        </div>
    )
}
