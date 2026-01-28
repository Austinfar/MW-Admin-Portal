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
import { cancelScheduledCharge } from '@/lib/actions/payment-schedules';

interface CancelChargeDialogProps {
    chargeId: string;
    amount: number;
    children: React.ReactNode;
    onSuccess?: () => void;
}

function formatCurrency(cents: number): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(cents / 100);
}

export function CancelChargeDialog({
    chargeId,
    amount,
    children,
    onSuccess,
}: CancelChargeDialogProps) {
    const [open, setOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    async function handleCancel() {
        setIsLoading(true);

        try {
            const result = await cancelScheduledCharge(chargeId);

            if (result.error) {
                toast.error(result.error);
            } else {
                toast.success('Charge cancelled successfully');
                setOpen(false);
                onSuccess?.();
            }
        } catch (err) {
            console.error('[CancelChargeDialog] Error:', err);
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
                    <AlertDialogTitle>Cancel Scheduled Charge?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will cancel the {formatCurrency(amount)} scheduled charge. The
                        charge will not be processed by the automatic payment system.
                        <br />
                        <br />
                        <strong>This action cannot be undone.</strong>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isLoading}>Keep Charge</AlertDialogCancel>
                    <Button
                        onClick={handleCancel}
                        disabled={isLoading}
                        variant="destructive"
                    >
                        {isLoading ? 'Cancelling...' : 'Cancel Charge'}
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
