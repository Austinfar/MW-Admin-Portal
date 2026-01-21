import { DashboardSkeleton } from '@/components/dashboard/widgets/base/WidgetSkeleton'
import { Skeleton } from '@/components/ui/skeleton'

export default function DashboardLoading() {
    return (
        <div className="flex-1 space-y-6">
            {/* Welcome Message Skeleton */}
            <div className="hidden md:block space-y-2">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-64" />
            </div>

            {/* Dashboard Skeleton */}
            <DashboardSkeleton />
        </div>
    )
}
