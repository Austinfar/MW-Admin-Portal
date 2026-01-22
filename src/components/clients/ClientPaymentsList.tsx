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
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <div>
                        <CardTitle>Payment History</CardTitle>
                        <CardDescription>No payments found for this client.</CardDescription>
                    </div>
                    {stripeCustomerId && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleSync}
                            disabled={isSyncing}
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
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                    <CardTitle>Payment History</CardTitle>
                    <CardDescription>Recent transactions synced from Stripe.</CardDescription>
                </div>
                {stripeCustomerId && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSync}
                        disabled={isSyncing}
                    >
                        <RefreshCw className={`h-3 w-3 mr-1 ${isSyncing ? 'animate-spin' : ''}`} />
                        {isSyncing ? 'Syncing...' : 'Sync'}
                    </Button>
                )}
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {payments.map((payment) => {
                        const isRefunded = payment.status === 'refunded' || payment.status === 'partially_refunded'
                        const hasRefund = (payment.refund_amount || 0) > 0
                        const netAmount = payment.amount - (payment.refund_amount || 0)

                        return (
                            <div key={payment.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                                <div>
                                    <p className="font-medium text-sm">{payment.product_name || 'Payment'}</p>
                                    <p className="text-xs text-muted-foreground">{format(new Date(payment.payment_date), 'PPP')}</p>
                                </div>
                                <div className="text-right">
                                    {hasRefund ? (
                                        <div className="space-y-0.5">
                                            <p className="font-medium text-sm line-through text-muted-foreground">
                                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: payment.currency || 'USD' }).format(payment.amount)}
                                            </p>
                                            <p className="text-xs text-red-500">
                                                Refund: -{new Intl.NumberFormat('en-US', { style: 'currency', currency: payment.currency || 'USD' }).format(payment.refund_amount || 0)}
                                            </p>
                                            {payment.status === 'partially_refunded' && (
                                                <p className="font-medium text-sm text-emerald-600">
                                                    Net: {new Intl.NumberFormat('en-US', { style: 'currency', currency: payment.currency || 'USD' }).format(netAmount)}
                                                </p>
                                            )}
                                        </div>
                                    ) : (
                                        <p className="font-medium text-sm">
                                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: payment.currency || 'USD' }).format(payment.amount)}
                                        </p>
                                    )}
                                    <div className="mt-1">
                                        <Badge
                                            variant={payment.status === 'succeeded' ? 'default' : 'destructive'}
                                            className={`text-[10px] px-1.5 py-0 uppercase ${
                                                isRefunded ? 'bg-red-500/15 text-red-500' :
                                                payment.status === 'disputed' ? 'bg-amber-500/15 text-amber-500' :
                                                payment.status === 'failed' ? 'bg-red-500/15 text-red-500' :
                                                ''
                                            }`}
                                        >
                                            {payment.status === 'partially_refunded' ? 'Partial Refund' : payment.status}
                                        </Badge>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </CardContent>
        </Card>
    )
}
