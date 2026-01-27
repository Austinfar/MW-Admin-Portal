import { createClient } from '@/lib/supabase/server'
import { getExpiringClients, getRenewalStats } from '@/lib/actions/renewals'
import { getCoaches } from '@/lib/actions/clients'
import { RenewalsDashboard } from '@/components/renewals/RenewalsDashboard'
import { protectRoute } from '@/lib/protect-route'

export default async function RenewalsPage() {
    await protectRoute('can_view_clients')

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Get user role to determine if they see all clients or just their own
    const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', user?.id)
        .single()

    const isAdmin = userData?.role === 'super_admin' || userData?.role === 'admin'

    // Fetch expiring clients - filter by coach if not admin
    const [clients, stats, coaches] = await Promise.all([
        getExpiringClients({
            coachId: isAdmin ? undefined : user?.id,
            daysAhead: 60,
            includeExpired: true,
        }),
        getRenewalStats(),
        getCoaches(),
    ])

    return (
        <div className="flex-1 space-y-6">
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-foreground">Renewals</h2>
                    <p className="text-muted-foreground">
                        Track expiring contracts and manage client renewals.
                    </p>
                </div>
            </div>

            <RenewalsDashboard
                clients={clients}
                stats={stats}
                coaches={coaches}
                isAdmin={isAdmin}
                currentUserId={user?.id}
            />
        </div>
    )
}
