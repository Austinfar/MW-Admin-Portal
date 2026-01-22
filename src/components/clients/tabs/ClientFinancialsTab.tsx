'use client'

import { CreditCard } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ClientPaymentsList } from '@/components/clients/ClientPaymentsList'
import { Payment } from '@/types/payment'

interface ClientFinancialsTabProps {
    clientId: string
    stripeCustomerId?: string | null
    payments: Payment[]
}

export function ClientFinancialsTab({ clientId, stripeCustomerId, payments }: ClientFinancialsTabProps) {
    // Calculate financial totals
    const grossRevenue = payments
        .filter(p => p.status === 'succeeded' || p.status === 'refunded' || p.status === 'partially_refunded')
        .reduce((sum, p) => sum + p.amount, 0)
    const totalRefunds = payments.reduce((sum, p) => sum + (p.refund_amount || 0), 0)
    const netRevenue = grossRevenue - totalRefunds

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Revenue Summary (1/3) */}
            <Card className="bg-card/50 backdrop-blur-xl border-white/5 hover:border-primary/20 transition-all duration-300 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-base">Revenue Summary</CardTitle>
                    <div className="p-2 rounded-full bg-emerald-500/10 shrink-0">
                        <CreditCard className="h-4 w-4 text-emerald-500" />
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <div className={`text-2xl sm:text-3xl font-bold ${netRevenue >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(netRevenue)}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">Net Lifetime Revenue</p>
                    </div>

                    {totalRefunds > 0 && (
                        <>
                            <Separator className="bg-white/5" />
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Gross Revenue</span>
                                    <span className="font-medium">
                                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(grossRevenue)}
                                    </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Refunds</span>
                                    <span className="font-medium text-red-500">
                                        -{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalRefunds)}
                                    </span>
                                </div>
                            </div>
                        </>
                    )}

                    <Separator className="bg-white/5" />

                    <div className="grid grid-cols-2 gap-4 text-center">
                        <div>
                            <div className="text-xl font-bold text-foreground">
                                {payments.filter(p => p.status === 'succeeded').length}
                            </div>
                            <p className="text-xs text-muted-foreground">Successful</p>
                        </div>
                        <div>
                            <div className="text-xl font-bold text-foreground">
                                {payments.filter(p => p.status === 'failed').length}
                            </div>
                            <p className="text-xs text-muted-foreground">Failed</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Right Column: Payment History (2/3) */}
            <div className="lg:col-span-2">
                <ClientPaymentsList
                    payments={payments}
                    clientId={clientId}
                    stripeCustomerId={stripeCustomerId}
                />
            </div>
        </div>
    )
}
