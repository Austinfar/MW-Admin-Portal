'use client';

import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { updateScheduledCharge } from '@/lib/actions/payment-schedules';
import type { ScheduledCharge } from '@/types/subscription';

interface EditChargeDialogProps {
    charge: ScheduledCharge;
    children: React.ReactNode;
    onSuccess?: () => void;
}

export function EditChargeDialog({ charge, children, onSuccess }: EditChargeDialogProps) {
    const [open, setOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    // Amount stored in cents, display in dollars
    const [amount, setAmount] = useState((charge.amount / 100).toFixed(2));
    const [dueDate, setDueDate] = useState(charge.due_date);

    const resetForm = () => {
        setAmount((charge.amount / 100).toFixed(2));
        setDueDate(charge.due_date);
    };

    const handleOpenChange = (newOpen: boolean) => {
        if (newOpen) {
            resetForm();
        }
        setOpen(newOpen);
    };

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setIsLoading(true);

        const amountCents = Math.round(parseFloat(amount) * 100);

        if (isNaN(amountCents) || amountCents <= 0) {
            toast.error('Please enter a valid amount');
            setIsLoading(false);
            return;
        }

        if (!dueDate) {
            toast.error('Please select a due date');
            setIsLoading(false);
            return;
        }

        const result = await updateScheduledCharge(charge.id, {
            amount: amountCents,
            due_date: dueDate,
        });

        setIsLoading(false);

        if (result.error) {
            toast.error(result.error);
        } else {
            toast.success('Charge updated successfully');
            setOpen(false);
            onSuccess?.();
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                    <DialogTitle>Edit Scheduled Charge</DialogTitle>
                    <DialogDescription>
                        Update the amount or due date for this pending charge.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="amount">Amount ($)</Label>
                            <Input
                                id="amount"
                                type="number"
                                step="0.01"
                                min="0.01"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                placeholder="0.00"
                                required
                            />
                            <p className="text-xs text-muted-foreground">
                                Enter the amount in dollars (e.g., 150.00)
                            </p>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="dueDate">Due Date</Label>
                            <Input
                                id="dueDate"
                                type="date"
                                value={dueDate}
                                onChange={e => setDueDate(e.target.value)}
                                required
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setOpen(false)}
                            disabled={isLoading}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
