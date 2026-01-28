import { getEnhancedClients, getClientTypes, getCoaches, getClientStats } from '@/lib/actions/clients'
import { createClient } from '@/lib/supabase/server'
import { ClientsTable } from '@/components/clients/ClientsTable'
import { ClientStatsCards } from '@/components/clients/ClientStatsCards'
import { RefreshClientsButton } from '@/components/clients/RefreshClientsButton'

import { protectRoute } from '@/lib/protect-route'

export default async function ClientsPage() {
    await protectRoute('can_view_clients')

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const [clients, clientTypes, coaches, stats] = await Promise.all([
        getEnhancedClients(),
        getClientTypes(),
        getCoaches(),
        getClientStats()
    ])

    return (
        <div className="flex-1 space-y-6">
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-foreground">Clients</h2>
                    <p className="text-muted-foreground">
                        Manage your client roster, track statuses, and assign programs.
                    </p>
                </div>
                <div className="flex items-center space-x-2">
                    <RefreshClientsButton />
                </div>
            </div>

            <ClientStatsCards stats={stats} />

            <ClientsTable
                data={clients}
                clientTypes={clientTypes}
                coaches={coaches}
                currentUserId={user?.id}
            />
        </div>
    )
}
