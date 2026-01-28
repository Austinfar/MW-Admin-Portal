'use client';

import { useState } from 'react';
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cancelPaymentSchedule } from '@/lib/actions/payment-schedules';

interface CancelScheduleDialogProps {
    scheduleId: string;
    planName: string;
    children: React.ReactNode;
    onSuccess?: () => void;
}

export function CancelScheduleDialog({
    scheduleId,
    planName,
    children,
    onSuccess,
}: CancelScheduleDialogProps) {
    const [open, setOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    async function handleCancel() {
        setIsLoading(true);

        try {
            const result = await cancelPaymentSchedule(scheduleId);

            if (result.error) {
                toast.error(result.error);
            } else {
                toast.success('Payment schedule cancelled');
                setOpen(false);
                onSuccess?.();
            }
        } catch (err) {
            console.error('[CancelScheduleDialog] Error:', err);
            toast.error('An unexpected error occurred');
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Cancel Payment Schedule?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will cancel the &quot;{planName}&quot; payment schedule.
                        <br />
                        <br />
                        <strong className="text-amber-500">
                            Note: This does NOT automatically cancel pending charges.
                        </strong>{' '}
                        You will need to manually cancel any remaining charges to prevent
                        them from being processed.
                        <br />
                        <br />
                        This action cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isLoading}>Keep Schedule</AlertDialogCancel>
                    <Button
                        onClick={handleCancel}
                        disabled={isLoading}
                        variant="destructive"
                    >
                        {isLoading ? 'Cancelling...' : 'Cancel Schedule'}
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
