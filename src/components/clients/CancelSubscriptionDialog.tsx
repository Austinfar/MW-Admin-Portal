'use client'

import { useState } from 'react'
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { requestSubscriptionCancellation } from '@/lib/actions/subscriptions'
import { toast } from 'sonner'
import { Loader2, AlertTriangle, Clock } from 'lucide-react'

interface CancelSubscriptionDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    subscriptionId: string
    clientId: string
    clientName: string
    onSuccess?: () => void
}

export function CancelSubscriptionDialog({
    open,
    onOpenChange,
    subscriptionId,
    clientId,
    clientName,
    onSuccess
}: CancelSubscriptionDialogProps) {
    const [reason, setReason] = useState('')
    const [additionalNotes, setAdditionalNotes] = useState('')
    const [isLoading, setIsLoading] = useState(false)

    const handleSubmit = async () => {
        if (reason.trim().length < 10) {
            toast.error('Please provide a detailed reason (at least 10 characters)')
            return
        }

        setIsLoading(true)

        try {
            const result = await requestSubscriptionCancellation(
                subscriptionId,
                clientId,
                reason.trim(),
                additionalNotes.trim() || undefined
            )

            if (result.success) {
                toast.success('Cancellation request submitted for admin approval')
                setReason('')
                setAdditionalNotes('')
                onOpenChange(false)
                onSuccess?.()
            } else {
                toast.error(result.error || 'Failed to submit cancellation request')
            }
        } catch (error) {
            toast.error('An unexpected error occurred')
        } finally {
            setIsLoading(false)
        }
    }

    const handleOpenChange = (newOpen: boolean) => {
        if (!newOpen) {
            setReason('')
            setAdditionalNotes('')
        }
        onOpenChange(newOpen)
    }

    return (
        <AlertDialog open={open} onOpenChange={handleOpenChange}>
            <AlertDialogContent className="sm:max-w-md">
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-red-500" />
                        Request Subscription Cancellation
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        Submit a cancellation request for {clientName}&apos;s subscription.
                        This requires admin approval.
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <div className="space-y-4 py-4">
                    {/* Info Box */}
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                        <Clock className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                        <div className="text-xs">
                            <p className="font-medium text-blue-500">Cancel at Period End</p>
                            <p className="text-muted-foreground mt-0.5">
                                Once approved, the subscription will cancel at the end of the current
                                billing period. The client will retain access until then.
                            </p>
                        </div>
                    </div>

                    {/* Reason */}
                    <div className="space-y-2">
                        <Label htmlFor="reason">
                            Reason for Cancellation <span className="text-red-500">*</span>
                        </Label>
                        <Textarea
                            id="reason"
                            placeholder="Why is the client canceling? (minimum 10 characters)"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="min-h-[80px] bg-background/50"
                        />
                        {reason.length > 0 && reason.length < 10 && (
                            <p className="text-xs text-red-500">
                                {10 - reason.length} more characters required
                            </p>
                        )}
                    </div>

                    {/* Additional Notes */}
                    <div className="space-y-2">
                        <Label htmlFor="notes">Additional Notes (optional)</Label>
                        <Textarea
                            id="notes"
                            placeholder="Any additional context for the admin..."
                            value={additionalNotes}
                            onChange={(e) => setAdditionalNotes(e.target.value)}
                            className="min-h-[60px] bg-background/50"
                        />
                    </div>
                </div>

                <AlertDialogFooter className="gap-2 sm:gap-0">
                    <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
                    <Button
                        onClick={handleSubmit}
                        disabled={isLoading || reason.trim().length < 10}
                        variant="destructive"
                    >
                        {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Submit Request
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
