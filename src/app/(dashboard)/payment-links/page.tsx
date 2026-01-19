import { PaymentLinkGenerators } from '@/components/payment-links/PaymentLinkGenerators'
import { getStripeProducts, getCoaches, getSalesClosers, getClients, getLeadsForPaymentLinks } from '@/lib/actions/stripe-actions'

export const dynamic = 'force-dynamic'

export default async function PaymentLinksPage() {
    const { products, isTestMode } = await getStripeProducts()
    const coaches = await getCoaches()
    const closers = await getSalesClosers()
    const clients = await getClients()
    const leads = await getLeadsForPaymentLinks()

    return (
        <div className="p-8 space-y-8 max-w-7xl mx-auto">
            <div className="flex items-center justify-between">
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold tracking-tight">Payment Links</h1>
                    <p className="text-muted-foreground">
                        Generate and manage Stripe payment links for your clients.
                    </p>
                </div>
                {isTestMode && (
                    <div className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-bold border border-yellow-200">
                        TEST MODE
                    </div>
                )}
            </div>

            <PaymentLinkGenerators
                prices={products}
                isTestMode={isTestMode}
                coaches={coaches}
                closers={closers}
                clients={clients}
                leads={leads}
            />
        </div>
    )
}
