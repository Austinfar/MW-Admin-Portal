'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog'
import { Clock, Check, X, Loader2, AlertTriangle, User, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import {
    getPendingApprovalRequests,
    approveSubscriptionCancellation,
    rejectSubscriptionCancellation,
} from '@/lib/actions/subscriptions'
import type { ApprovalRequest } from '@/types/subscription'

interface ApprovalRequestsPanelProps {
    initialRequests?: ApprovalRequest[]
}

export function ApprovalRequestsPanel({ initialRequests }: ApprovalRequestsPanelProps) {
    const [requests, setRequests] = useState<ApprovalRequest[]>(initialRequests || [])
    const [loading, setLoading] = useState(!initialRequests)
    const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null)
    const [isApproving, setIsApproving] = useState(false)
    const [isRejecting, setIsRejecting] = useState(false)
    const [showRejectDialog, setShowRejectDialog] = useState(false)
    const [rejectionNotes, setRejectionNotes] = useState('')
    const router = useRouter()

    useEffect(() => {
        if (!initialRequests) {
            loadRequests()
        }
    }, [])

    const loadRequests = async () => {
        setLoading(true)
        const data = await getPendingApprovalRequests()
        setRequests(data)
        setLoading(false)
    }

    const handleApprove = async (request: ApprovalRequest) => {
        setSelectedRequest(request)
        setIsApproving(true)

        try {
            const result = await approveSubscriptionCancellation(request.id)
            if (result.error) {
                toast.error(result.error)
            } else {
                toast.success('Cancellation approved - subscription will cancel at period end')
                setRequests(prev => prev.filter(r => r.id !== request.id))
                router.refresh()
            }
        } catch {
            toast.error('Failed to approve cancellation')
        } finally {
            setIsApproving(false)
            setSelectedRequest(null)
        }
    }

    const handleRejectClick = (request: ApprovalRequest) => {
        setSelectedRequest(request)
        setShowRejectDialog(true)
        setRejectionNotes('')
    }

    const handleRejectConfirm = async () => {
        if (!selectedRequest) return

        if (rejectionNotes.trim().length < 10) {
            toast.error('Please provide a reason for rejection (at least 10 characters)')
            return
        }

        setIsRejecting(true)

        try {
            const result = await rejectSubscriptionCancellation(selectedRequest.id, rejectionNotes)
            if (result.error) {
                toast.error(result.error)
            } else {
                toast.success('Cancellation request rejected')
                setRequests(prev => prev.filter(r => r.id !== selectedRequest.id))
                setShowRejectDialog(false)
                router.refresh()
            }
        } catch {
            toast.error('Failed to reject cancellation')
        } finally {
            setIsRejecting(false)
            setSelectedRequest(null)
        }
    }

    const getRequestTypeLabel = (type: string) => {
        switch (type) {
            case 'subscription_cancel':
                return 'Subscription Cancellation'
            case 'refund':
                return 'Refund Request'
            default:
                return type
        }
    }

    if (loading) {
        return (
            <Card className="bg-card/50 backdrop-blur-xl border-white/5">
                <CardContent className="py-8">
                    <div className="flex items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                </CardContent>
            </Card>
        )
    }

    if (requests.length === 0) {
        return (
            <Card className="bg-card/50 backdrop-blur-xl border-white/5">
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Clock className="h-5 w-5 text-primary" />
                        Pending Approvals
                    </CardTitle>
                    <CardDescription>Review and process approval requests</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                        <Check className="h-10 w-10 text-emerald-500/50 mb-3" />
                        <p className="text-sm text-muted-foreground">
                            No pending approval requests
                        </p>
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <>
            <Card className="bg-card/50 backdrop-blur-xl border-white/5">
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Clock className="h-5 w-5 text-primary" />
                                Pending Approvals
                            </CardTitle>
                            <CardDescription>Review and process approval requests</CardDescription>
                        </div>
                        <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-400">
                            {requests.length} pending
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {requests.map((request) => (
                            <div
                                key={request.id}
                                className="p-4 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                            >
                                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0 space-y-2">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <Badge
                                                variant="outline"
                                                className="border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs"
                                            >
                                                <AlertTriangle className="h-3 w-3 mr-1" />
                                                {getRequestTypeLabel(request.request_type)}
                                            </Badge>
                                        </div>

                                        <div className="space-y-1">
                                            <p className="font-medium text-sm">
                                                {(request as any).client?.name || 'Unknown Client'}
                                            </p>
                                            <p className="text-sm text-muted-foreground line-clamp-2">
                                                {request.reason}
                                            </p>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                            <span className="flex items-center gap-1">
                                                <User className="h-3 w-3" />
                                                {(request as any).requester?.name || 'Unknown'}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Calendar className="h-3 w-3" />
                                                {format(new Date(request.created_at), 'MMM d, h:mm a')}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex gap-2 sm:flex-col">
                                        <Button
                                            size="sm"
                                            onClick={() => handleApprove(request)}
                                            disabled={isApproving && selectedRequest?.id === request.id}
                                            className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30"
                                        >
                                            {isApproving && selectedRequest?.id === request.id ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <>
                                                    <Check className="h-4 w-4 mr-1" />
                                                    Approve
                                                </>
                                            )}
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleRejectClick(request)}
                                            disabled={isRejecting && selectedRequest?.id === request.id}
                                            className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                                        >
                                            <X className="h-4 w-4 mr-1" />
                                            Reject
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reject Request</DialogTitle>
                        <DialogDescription>
                            Please provide a reason for rejecting this cancellation request.
                            The requester will be notified.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="rejection-notes">Reason for Rejection</Label>
                            <Textarea
                                id="rejection-notes"
                                placeholder="Explain why this request is being rejected..."
                                value={rejectionNotes}
                                onChange={(e) => setRejectionNotes(e.target.value)}
                                className="min-h-[100px] bg-black/20 border-white/10"
                            />
                            <p className="text-xs text-muted-foreground">
                                Minimum 10 characters required
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setShowRejectDialog(false)}
                            disabled={isRejecting}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleRejectConfirm}
                            disabled={isRejecting || rejectionNotes.trim().length < 10}
                            className="bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30"
                        >
                            {isRejecting ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Rejecting...
                                </>
                            ) : (
                                'Reject Request'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
