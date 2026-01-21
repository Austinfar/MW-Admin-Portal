import { getSubscriptionsWithConfigs } from '@/lib/actions/subscription-commission'
import { getCoaches, getClients, getSalesClosers } from '@/lib/actions/stripe-actions'
import { SubscriptionsManagement } from '@/components/commissions/SubscriptionsManagement'
import { Separator } from '@/components/ui/separator'

export default async function SubscriptionsPage() {
    const [{ subscriptions }, coaches, closers, clients] = await Promise.all([
        getSubscriptionsWithConfigs(),
        getCoaches(),
        getSalesClosers(),
        getClients(),
    ])

    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Subscription Commissions</h2>
                    <p className="text-muted-foreground">
                        Link Stripe subscriptions to coaches for automatic commission tracking on renewals.
                    </p>
                </div>
            </div>

            <Separator />

            <SubscriptionsManagement
                subscriptions={subscriptions}
                coaches={coaches}
                closers={closers}
                clients={clients}
            />
        </div>
    )
}
