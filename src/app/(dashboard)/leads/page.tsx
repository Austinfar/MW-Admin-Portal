import { Suspense } from 'react'
import { getLeads } from '@/lib/actions/lead-actions'
import { LeadsTable } from '@/components/leads/LeadsTable'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SyncGHLButton } from '@/components/leads/SyncGHLButton'
import { AddLeadDialog } from '@/components/leads/AddLeadDialog'
import { Skeleton } from '@/components/ui/skeleton'
import { protectRoute } from '@/lib/protect-route'

export default async function LeadsPage() {
    await protectRoute('can_view_leads')

    const leads = await getLeads()

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight text-white">Leads</h2>
                <div className="flex items-center space-x-2">
                    <SyncGHLButton />
                    <AddLeadDialog />
                </div>
            </div>

            <Suspense fallback={<LeadsSkeleton />}>
                <LeadsTable initialLeads={leads || []} />
            </Suspense>
        </div>
    )
}

function LeadsSkeleton() {
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <Skeleton className="h-8 w-[250px]" />
                <Skeleton className="h-8 w-[100px]" />
            </div>
            <div className="rounded-md border">
                <div className="h-24 bg-muted/50" />
                <div className="h-24" />
                <div className="h-24 bg-muted/50" />
            </div>
        </div>
    )
}
