'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import {
    CreditCard,
    Calendar,
    Pause,
    Play,
    XCircle,
    Clock,
    AlertTriangle,
    Loader2
} from 'lucide-react'
import { PauseSubscriptionDialog } from './PauseSubscriptionDialog'
import { CancelSubscriptionDialog } from './CancelSubscriptionDialog'
import { resumeSubscription, getActiveFreeze } from '@/lib/actions/subscriptions'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import type { ClientSubscription, ApprovalRequest, SubscriptionFreeze } from '@/types/subscription'

interface SubscriptionManagementCardProps {
    clientId: string
    clientName: string
    subscription: ClientSubscription | null
    canManage: boolean
    pendingRequest?: ApprovalRequest | null
    activeFreeze?: SubscriptionFreeze | null
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
    active: { label: 'Active', className: 'bg-emerald-500/15 text-emerald-500' },
    paused: { label: 'Paused', className: 'bg-amber-500/15 text-amber-500' },
    trialing: { label: 'Trialing', className: 'bg-blue-500/15 text-blue-500' },
    past_due: { label: 'Past Due', className: 'bg-red-500/15 text-red-500' },
    canceled: { label: 'Canceled', className: 'bg-gray-500/15 text-gray-500' },
    incomplete: { label: 'Incomplete', className: 'bg-amber-500/15 text-amber-500' },
    unpaid: { label: 'Unpaid', className: 'bg-red-500/15 text-red-500' },
}

export function SubscriptionManagementCard({
    clientId,
    clientName,
    subscription,
    canManage,
    pendingRequest,
    activeFreeze
}: SubscriptionManagementCardProps) {
    const router = useRouter()
    const [showPauseDialog, setShowPauseDialog] = useState(false)
    const [showCancelDialog, setShowCancelDialog] = useState(false)
    const [isResuming, setIsResuming] = useState(false)

    if (!subscription) {
        return (
            <Card className="bg-card/50 backdrop-blur-xl border-white/5 hover:border-primary/20 transition-all duration-300 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-base">Subscription</CardTitle>
                    <div className="p-2 rounded-full bg-muted/50 shrink-0">
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                    </div>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">No active subscription found.</p>
                </CardContent>
            </Card>
        )
    }

    const isPaused = Boolean(subscription.paused_at) || subscription.status === 'paused'
    const isCanceling = subscription.cancel_at_period_end
    const hasPendingCancelRequest = pendingRequest?.status === 'pending'
    const statusConfig = STATUS_CONFIG[subscription.status] || STATUS_CONFIG.active

    const handleResume = async () => {
        if (!activeFreeze) {
            toast.error('No active freeze to resume')
            return
        }

        setIsResuming(true)
        try {
            const result = await resumeSubscription(activeFreeze.id)
            if (result.success) {
                toast.success('Subscription resumed successfully')
                router.refresh()
            } else {
                toast.error(result.error || 'Failed to resume subscription')
            }
        } catch (error) {
            toast.error('An unexpected error occurred')
        } finally {
            setIsResuming(false)
        }
    }

    const formatInterval = () => {
        const count = subscription.interval_count || 1
        const interval = subscription.interval || 'month'
        if (count === 1) return interval
        return `${count} ${interval}s`
    }

    return (
        <>
            <Card className="bg-card/50 backdrop-blur-xl border-white/5 hover:border-primary/20 transition-all duration-300 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-base">Subscription</CardTitle>
                    <div className="p-2 rounded-full bg-blue-500/10 shrink-0">
                        <CreditCard className="h-4 w-4 text-blue-500" />
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Status Badge */}
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Status</span>
                        <div className="flex items-center gap-2">
                            <Badge className={`${statusConfig.className} text-xs`}>
                                {statusConfig.label}
                            </Badge>
                            {isPaused && (
                                <Badge className="bg-amber-500/15 text-amber-500 text-xs">
                                    <Pause className="h-3 w-3 mr-1" />
                                    Paused
                                </Badge>
                            )}
                            {isCanceling && (
                                <Badge className="bg-red-500/15 text-red-500 text-xs">
                                    Canceling
                                </Badge>
                            )}
                        </div>
                    </div>

                    {/* Plan Details */}
                    <div className="space-y-2 border-t border-white/5 pt-3">
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Plan</span>
                            <span className="text-sm font-medium">
                                {subscription.plan_name || 'Subscription'}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Amount</span>
                            <span className="text-sm font-medium">
                                {new Intl.NumberFormat('en-US', {
                                    style: 'currency',
                                    currency: subscription.currency || 'USD'
                                }).format(subscription.amount)}
                                <span className="text-muted-foreground">/{formatInterval()}</span>
                            </span>
                        </div>
                    </div>

                    {/* Billing Info */}
                    <div className="space-y-2 border-t border-white/5 pt-3">
                        {subscription.next_billing_date && !isPaused && !isCanceling && (
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    Next Billing
                                </span>
                                <span className="text-sm font-medium">
                                    {format(new Date(subscription.next_billing_date), 'MMM d, yyyy')}
                                </span>
                            </div>
                        )}

                        {isPaused && subscription.resume_at && (
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    Resumes
                                </span>
                                <span className="text-sm font-medium text-amber-500">
                                    {format(new Date(subscription.resume_at), 'MMM d, yyyy')}
                                </span>
                            </div>
                        )}

                        {isCanceling && subscription.current_period_end && (
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground flex items-center gap-1">
                                    <XCircle className="h-3 w-3" />
                                    Cancels On
                                </span>
                                <span className="text-sm font-medium text-red-500">
                                    {format(new Date(subscription.current_period_end), 'MMM d, yyyy')}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Pending Request Warning */}
                    {hasPendingCancelRequest && (
                        <div className="flex items-start gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                            <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                            <div className="text-xs">
                                <p className="font-medium text-amber-500">Cancellation Pending</p>
                                <p className="text-muted-foreground mt-0.5">
                                    Awaiting admin approval
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Action Buttons */}
                    {canManage && !isCanceling && (
                        <div className="flex gap-2 pt-2 border-t border-white/5">
                            {isPaused && activeFreeze ? (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1 bg-card/50 border-white/10 hover:border-emerald-500/30 hover:bg-emerald-500/10"
                                    onClick={handleResume}
                                    disabled={isResuming}
                                >
                                    {isResuming ? (
                                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                    ) : (
                                        <Play className="h-3 w-3 mr-1" />
                                    )}
                                    Resume
                                </Button>
                            ) : (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1 bg-card/50 border-white/10 hover:border-amber-500/30 hover:bg-amber-500/10"
                                    onClick={() => setShowPauseDialog(true)}
                                    disabled={isPaused}
                                >
                                    <Pause className="h-3 w-3 mr-1" />
                                    Pause
                                </Button>
                            )}
                            <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 bg-card/50 border-white/10 hover:border-red-500/30 hover:bg-red-500/10"
                                onClick={() => setShowCancelDialog(true)}
                                disabled={hasPendingCancelRequest}
                            >
                                <XCircle className="h-3 w-3 mr-1" />
                                Cancel
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            <PauseSubscriptionDialog
                open={showPauseDialog}
                onOpenChange={setShowPauseDialog}
                subscriptionId={subscription.stripe_subscription_id}
                clientId={clientId}
                clientName={clientName}
                onSuccess={() => router.refresh()}
            />

            <CancelSubscriptionDialog
                open={showCancelDialog}
                onOpenChange={setShowCancelDialog}
                subscriptionId={subscription.stripe_subscription_id}
                clientId={clientId}
                clientName={clientName}
                onSuccess={() => router.refresh()}
            />
        </>
    )
}
