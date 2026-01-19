import { getClients, getClientTypes, getCoaches } from '@/lib/actions/clients'
import { createClient } from '@/lib/supabase/server'
import { ClientsTable } from '@/components/clients/ClientsTable'

export default async function ClientsPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const [clients, clientTypes, coaches] = await Promise.all([
        getClients(),
        getClientTypes(),
        getCoaches()
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
            </div>
            <ClientsTable
                data={clients}
                clientTypes={clientTypes}
                coaches={coaches}
                currentUserId={user?.id}
            />
        </div>
    )
}
