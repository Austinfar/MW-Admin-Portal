'use client'

import { useState } from 'react'
import { Payment } from '@/types/payment'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import { RefreshCw } from 'lucide-react'
import { syncClientPaymentsFromStripe } from '@/lib/actions/stripe-sync'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface ClientPaymentsListProps {
    payments: Payment[]
    clientId?: string
    stripeCustomerId?: string | null
}

export function ClientPaymentsList({ payments, clientId, stripeCustomerId }: ClientPaymentsListProps) {
    const [isSyncing, setIsSyncing] = useState(false)
    const router = useRouter()

    const handleSync = async () => {
        if (!clientId || !stripeCustomerId) {
            toast.error('No Stripe Customer ID linked to this client')
            return
        }

        setIsSyncing(true)
        try {
            const result = await syncClientPaymentsFromStripe(clientId, stripeCustomerId)
            if (result.error) {
                toast.error(`Sync failed: ${result.error}`)
            } else {
                const refundMsg = result.refundsFound && result.refundsFound > 0
                    ? ` (${result.refundsFound} refund${result.refundsFound > 1 ? 's' : ''} found)`
                    : ''
                toast.success(`Synced ${result.synced} payments from Stripe${refundMsg}`)
                router.refresh()
            }
        } catch (error) {
            toast.error('An unexpected error occurred')
        } finally {
            setIsSyncing(false)
        }
    }

    if (payments.length === 0) {
        return (
            <Card>
                <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 space-y-0 px-3 sm:px-6">
                    <div>
                        <CardTitle className="text-base sm:text-lg">Payment History</CardTitle>
                        <CardDescription className="text-xs sm:text-sm">No payments found for this client.</CardDescription>
                    </div>
                    {stripeCustomerId && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleSync}
                            disabled={isSyncing}
                            className="w-full sm:w-auto"
                        >
                            <RefreshCw className={`h-3 w-3 mr-1 ${isSyncing ? 'animate-spin' : ''}`} />
                            {isSyncing ? 'Syncing...' : 'Sync Stripe'}
                        </Button>
                    )}
                </CardHeader>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 space-y-0 px-3 sm:px-6">
                <div>
                    <CardTitle className="text-base sm:text-lg">Payment History</CardTitle>
                    <CardDescription className="text-xs sm:text-sm">Recent transactions synced from Stripe.</CardDescription>
                </div>
                {stripeCustomerId && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSync}
                        disabled={isSyncing}
                        className="w-full sm:w-auto"
                    >
                        <RefreshCw className={`h-3 w-3 mr-1 ${isSyncing ? 'animate-spin' : ''}`} />
                        {isSyncing ? 'Syncing...' : 'Sync'}
                    </Button>
                )}
            </CardHeader>
            <CardContent className="px-3 sm:px-6">
                <div className="space-y-3 sm:space-y-4 max-h-[300px] lg:max-h-[400px] overflow-y-auto scrollbar-thin">
                    {payments.map((payment) => {
                        const isRefunded = payment.status === 'refunded' || payment.status === 'partially_refunded'
                        const hasRefund = (payment.refund_amount || 0) > 0
                        const netAmount = payment.amount - (payment.refund_amount || 0)

                        return (
                            <div key={payment.id} className="flex flex-col xs:flex-row xs:items-center xs:justify-between gap-2 border-b pb-3 sm:pb-4 last:border-0 last:pb-0">
                                <div className="min-w-0 flex-1">
                                    <p className="font-medium text-sm truncate">{payment.product_name || 'Payment'}</p>
                                    <p className="text-xs text-muted-foreground">{format(new Date(payment.payment_date), 'PP')}</p>
                                </div>
                                <div className="flex items-center justify-between xs:justify-end gap-2 xs:text-right">
                                    <div>
                                        {hasRefund ? (
                                            <div className="space-y-0.5">
                                                <p className="font-medium text-sm line-through text-muted-foreground">
                                                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: payment.currency || 'USD' }).format(payment.amount)}
                                                </p>
                                                <p className="text-xs text-red-500">
                                                    -{new Intl.NumberFormat('en-US', { style: 'currency', currency: payment.currency || 'USD' }).format(payment.refund_amount || 0)}
                                                </p>
                                                {payment.status === 'partially_refunded' && (
                                                    <p className="font-medium text-sm text-emerald-600">
                                                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: payment.currency || 'USD' }).format(netAmount)}
                                                    </p>
                                                )}
                                            </div>
                                        ) : (
                                            <p className="font-medium text-sm">
                                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: payment.currency || 'USD' }).format(payment.amount)}
                                            </p>
                                        )}
                                    </div>
                                    <Badge
                                        variant={payment.status === 'succeeded' ? 'default' : 'destructive'}
                                        className={`text-[10px] px-1.5 py-0 uppercase shrink-0 ${
                                            isRefunded ? 'bg-red-500/15 text-red-500' :
                                            payment.status === 'disputed' ? 'bg-amber-500/15 text-amber-500' :
                                            payment.status === 'failed' ? 'bg-red-500/15 text-red-500' :
                                            ''
                                        }`}
                                    >
                                        {payment.status === 'partially_refunded' ? 'Partial' : payment.status}
                                    </Badge>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </CardContent>
        </Card>
    )
}
