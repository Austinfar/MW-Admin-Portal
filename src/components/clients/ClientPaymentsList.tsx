'use client'

import { Payment } from '@/types/payment'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'

interface ClientPaymentsListProps {
    payments: Payment[]
}

export function ClientPaymentsList({ payments }: ClientPaymentsListProps) {
    if (payments.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Payment History</CardTitle>
                    <CardDescription>No payments found for this client.</CardDescription>
                </CardHeader>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Payment History</CardTitle>
                <CardDescription>Recent transactions synced from Stripe.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {payments.map((payment) => (
                        <div key={payment.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                            <div>
                                <p className="font-medium text-sm">{payment.description || 'Payment'}</p>
                                <p className="text-xs text-muted-foreground">{format(new Date(payment.created), 'PPP')}</p>
                            </div>
                            <div className="text-right">
                                <p className="font-medium text-sm">
                                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: payment.currency }).format(payment.amount)}
                                </p>
                                <div className="mt-1">
                                    <Badge variant={payment.status === 'succeeded' ? 'default' : 'destructive'} className="text-[10px] px-1.5 py-0 uppercase">
                                        {payment.status}
                                    </Badge>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}
