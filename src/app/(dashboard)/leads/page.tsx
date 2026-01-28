import { Suspense } from 'react'
import {
    getEnhancedLeads,
    getSettersAndClosers,
    getLeadStats,
    getLeadFunnelData,
    getLeadSourceBreakdown
} from '@/lib/actions/lead-analytics'
import { getCurrentUserProfile } from '@/lib/actions/profile'
import { LeadsPageContent } from '@/components/leads/LeadsPageContent'
import { SyncGHLButton } from '@/components/leads/SyncGHLButton'
import { AddLeadDialog } from '@/components/leads/AddLeadDialog'
import { Skeleton } from '@/components/ui/skeleton'
import { protectRoute } from '@/lib/protect-route'

import { RefreshLeadsButton } from '@/components/leads/RefreshLeadsButton'

export default async function LeadsPage() {
    await protectRoute('can_view_leads')

    // Fetch all data in parallel
    const [leads, users, currentUser, stats, funnelData, sourceData] = await Promise.all([
        getEnhancedLeads(),
        getSettersAndClosers(),
        getCurrentUserProfile(),
        getLeadStats(),
        getLeadFunnelData('30d'),
        getLeadSourceBreakdown()
    ])

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight text-white">Leads</h2>
                <div className="flex items-center space-x-2">
                    <RefreshLeadsButton />
                    <AddLeadDialog />
                </div>
            </div>

            <Suspense fallback={<LeadsSkeleton />}>
                <LeadsPageContent
                    leads={leads || []}
                    users={users || []}
                    currentUserId={currentUser?.id}
                    stats={stats}
                    funnelData={funnelData}
                    sourceData={sourceData}
                />
            </Suspense>

            <div className="flex justify-center pt-8 pb-4 opacity-30 hover:opacity-100 transition-opacity">
                <SyncGHLButton />
            </div>
        </div>
    )
}

function LeadsSkeleton() {
    return (
        <div className="space-y-6">
            {/* Stats skeleton */}
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-[120px] rounded-xl" />
                ))}
            </div>

            {/* Funnel & Source skeleton */}
            <div className="grid gap-6 md:grid-cols-3">
                <Skeleton className="h-[300px] rounded-xl md:col-span-2" />
                <Skeleton className="h-[300px] rounded-xl" />
            </div>

            {/* Table skeleton */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <Skeleton className="h-8 w-[250px]" />
                    <Skeleton className="h-8 w-[100px]" />
                </div>
                <div className="rounded-md border border-zinc-800">
                    <div className="h-16 bg-muted/20" />
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className={i % 2 === 0 ? "h-16 bg-muted/10" : "h-16"} />
                    ))}
                </div>
            </div>
        </div>
    )
}
