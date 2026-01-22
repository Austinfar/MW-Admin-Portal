'use client';

import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { recalculateCommissionsForPeriod } from '@/lib/actions/payroll';
import { PayPeriod } from './PeriodSelector';
import { format } from 'date-fns';

interface RecalculateCommissionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    period: PayPeriod | null;
    onSuccess: () => void;
}

export function RecalculateCommissionDialog({
    open,
    onOpenChange,
    period,
    onSuccess
}: RecalculateCommissionDialogProps) {
    const [isLoading, setIsLoading] = useState(false);

    async function handleRecalculate() {
        if (!period) return;

        setIsLoading(true);
        try {
            const result = await recalculateCommissionsForPeriod(period.start, period.end);

            if (result.errors && result.errors.length > 0) {
                console.error('Recalculation errors:', result.errors);
                toast.error(`Recalculation finished with ${result.failed} errors. Check console details.`);
            } else {
                toast.success(`Recalculated ${result.processed} payments. (${result.skipped} skipped)`);
            }

            onOpenChange(false);
            onSuccess();
        } catch (error) {
            console.error('Failed to recalculate:', error);
            toast.error('An unexpected error occurred during recalculation');
        } finally {
            setIsLoading(false);
        }
    }

    if (!period) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px] bg-[#1a1a1a] border-white/10 text-white">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-amber-500">
                        <AlertTriangle className="h-5 w-5" />
                        Recalculate Commissions
                    </DialogTitle>
                    <DialogDescription className="text-gray-400">
                        This involves voiding existing commissions and recalculating them for the period{' '}
                        <span className="font-medium text-white">
                            {format(period.start, 'MMM d')} - {format(period.end, 'MMM d, yyyy')}
                        </span>.
                        <br /><br />
                        <span className="text-amber-500/80 text-xs uppercase font-bold tracking-wider">
                            Warning: This cannot be undone.
                        </span>
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 text-sm text-gray-300">
                    <p>Use this tool if:</p>
                    <ul className="list-disc pl-5 space-y-1 mt-2 text-xs">
                        <li>Stripe fees were missing from initial calculations.</li>
                        <li>Commission rules were updated and need to apply retroactively.</li>
                        <li>Client matching was corrected.</li>
                    </ul>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        className="border-white/10 hover:bg-white/5 hover:text-white"
                        disabled={isLoading}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleRecalculate}
                        disabled={isLoading}
                        className="bg-amber-600 hover:bg-amber-700 text-white border-none"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Processing...
                            </>
                        ) : (
                            'Confirm Recalculation'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
