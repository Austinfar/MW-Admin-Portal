'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import {
    Clock,
    CheckCircle,
    XCircle,
    AlertCircle,
    Edit2,
    Trash2,
    ExternalLink,
} from 'lucide-react';
import type { PaymentScheduleWithClientInfo, ScheduledCharge } from '@/types/subscription';
import { EditChargeDialog } from './EditChargeDialog';
import { CancelChargeDialog } from './CancelChargeDialog';
import { CancelScheduleDialog } from './CancelScheduleDialog';

interface ScheduleDetailSheetProps {
    schedule: PaymentScheduleWithClientInfo | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

function formatCurrency(cents: number): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(cents / 100);
}

function getStatusColor(status: string): string {
    switch (status) {
        case 'active':
            return 'bg-emerald-500';
        case 'completed':
            return 'bg-blue-500';
        case 'cancelled':
            return 'bg-red-500';
        case 'pending_initial':
            return 'bg-yellow-500';
        default:
            return 'bg-gray-500';
    }
}

function getChargeStatusIcon(status: string) {
    switch (status) {
        case 'paid':
            return <CheckCircle className="h-4 w-4 text-emerald-500" />;
        case 'failed':
            return <XCircle className="h-4 w-4 text-red-500" />;
        case 'cancelled':
            return <XCircle className="h-4 w-4 text-gray-500" />;
        default:
            return <Clock className="h-4 w-4 text-amber-500" />;
    }
}

export function ScheduleDetailSheet({
    schedule,
    open,
    onOpenChange,
}: ScheduleDetailSheetProps) {
    const router = useRouter();

    const scheduledCharges = schedule?.scheduled_charges;
    const { pendingCharges, pastCharges, paidChargesTotal, pendingChargesTotal } = useMemo(() => {
        if (!scheduledCharges) {
            return {
                pendingCharges: [],
                pastCharges: [],
                paidChargesTotal: 0,
                pendingChargesTotal: 0
            };
        }

        const sorted = [...scheduledCharges].sort(
            (a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
        );

        const pending = sorted.filter(c => c.status === 'pending');
        const past = sorted.filter(c => c.status !== 'pending');
        const paidTotal = sorted
            .filter(c => c.status === 'paid')
            .reduce((sum, c) => sum + c.amount, 0);
        const pendingTotal = pending.reduce((sum, c) => sum + c.amount, 0);

        return {
            pendingCharges: pending,
            pastCharges: past,
            paidChargesTotal: paidTotal,
            pendingChargesTotal: pendingTotal,
        };
    }, [scheduledCharges]);

    // Calculate accurate totals
    const downPayment = schedule?.amount || 0;
    const isScheduleActive = schedule?.status === 'active' || schedule?.status === 'completed';
    const totalPaid = (isScheduleActive ? downPayment : 0) + paidChargesTotal;
    const actualRemaining = pendingChargesTotal;

    const canCancelSchedule =
        schedule &&
        schedule.status !== 'cancelled' &&
        schedule.status !== 'completed';

    if (!schedule) return null;

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
                <SheetHeader>
                    <SheetTitle>{schedule.plan_name || 'Payment Schedule'}</SheetTitle>
                    <SheetDescription>
                        {schedule.client ? (
                            <span className="flex items-center gap-2">
                                {schedule.client.name} - {schedule.client.email}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                    onClick={() => {
                                        router.push(`/clients/${schedule.client!.id}`);
                                        onOpenChange(false);
                                    }}
                                >
                                    <ExternalLink className="h-3 w-3" />
                                </Button>
                            </span>
                        ) : (
                            'No linked client'
                        )}
                    </SheetDescription>
                </SheetHeader>

                {/* Warning Banner if client is inactive/lost */}
                {schedule.hasClientWarning && (
                    <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                        <div className="flex items-center gap-2 text-red-500">
                            <AlertCircle className="h-4 w-4" />
                            <span className="text-sm font-medium">
                                Client is {schedule.client?.status} but has{' '}
                                {schedule.pendingChargesCount} pending charge
                                {schedule.pendingChargesCount !== 1 ? 's' : ''}
                            </span>
                        </div>
                        <p className="mt-1 text-xs text-red-400">
                            These charges will still be processed by the cron job unless
                            cancelled manually.
                        </p>
                    </div>
                )}

                {/* Schedule Summary */}
                <div className="mt-6 space-y-3">
                    <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Status</span>
                        <Badge className={`${getStatusColor(schedule.status)} text-white`}>
                            {schedule.status?.replace('_', ' ').toUpperCase()}
                        </Badge>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Payment Type</span>
                        <span className="font-medium capitalize">
                            {schedule.payment_type?.replace('_', ' ') || '-'}
                        </span>
                    </div>

                    <Separator className="my-2" />

                    {/* Financial Summary */}
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Contract Value</span>
                        <span className="font-medium">
                            {formatCurrency(schedule.total_amount || 0)}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">
                            Down Payment {isScheduleActive && <span className="text-emerald-500 text-xs">(Paid)</span>}
                        </span>
                        <span className={`font-medium ${isScheduleActive ? 'text-emerald-500' : ''}`}>
                            {formatCurrency(downPayment)}
                        </span>
                    </div>
                    {paidChargesTotal > 0 && (
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Installments Paid</span>
                            <span className="font-medium text-emerald-500">
                                {formatCurrency(paidChargesTotal)}
                            </span>
                        </div>
                    )}
                    <div className="flex justify-between border-t pt-2">
                        <span className="font-medium">Total Collected</span>
                        <span className="font-bold text-emerald-500">
                            {formatCurrency(totalPaid)}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span className="font-medium">Remaining Balance</span>
                        <span className={`font-bold ${actualRemaining > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                            {formatCurrency(actualRemaining)}
                        </span>
                    </div>

                    <Separator className="my-2" />

                    {schedule.start_date && (
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Start Date</span>
                            <span>
                                {format(new Date(schedule.start_date), 'MMM d, yyyy')}
                            </span>
                        </div>
                    )}
                    {schedule.program_term && (
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Program Term</span>
                            <span>{schedule.program_term} months</span>
                        </div>
                    )}
                </div>

                {/* Cancel Schedule Button */}
                {canCancelSchedule && (
                    <div className="mt-4">
                        <CancelScheduleDialog
                            scheduleId={schedule.id}
                            planName={schedule.plan_name || 'Payment Schedule'}
                            onSuccess={() => {
                                onOpenChange(false);
                                router.refresh();
                            }}
                        >
                            <Button variant="destructive" size="sm" className="w-full">
                                Cancel Schedule
                            </Button>
                        </CancelScheduleDialog>
                    </div>
                )}

                <Separator className="my-6" />

                {/* Pending Charges - Editable */}
                {pendingCharges.length > 0 && (
                    <div>
                        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                            <Clock className="h-4 w-4 text-amber-500" />
                            Pending Charges ({pendingCharges.length})
                        </h4>
                        <div className="space-y-2">
                            {pendingCharges.map((charge, index) => (
                                <ChargeRow
                                    key={charge.id}
                                    charge={charge}
                                    index={index + 1}
                                    totalPending={pendingCharges.length}
                                    editable
                                    onUpdate={() => router.refresh()}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* Past Charges - Read Only */}
                {pastCharges.length > 0 && (
                    <div className="mt-6">
                        <h4 className="text-sm font-medium mb-3 text-muted-foreground">
                            Past Charges ({pastCharges.length})
                        </h4>
                        <div className="space-y-2">
                            {pastCharges.map(charge => (
                                <ChargeRow
                                    key={charge.id}
                                    charge={charge}
                                    editable={false}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* No Charges */}
                {pendingCharges.length === 0 && pastCharges.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                        No scheduled charges for this payment schedule.
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
}

interface ChargeRowProps {
    charge: ScheduledCharge;
    index?: number;
    totalPending?: number;
    editable?: boolean;
    onUpdate?: () => void;
}

function ChargeRow({ charge, index, totalPending, editable, onUpdate }: ChargeRowProps) {
    const isPastDue =
        charge.status === 'pending' && new Date(charge.due_date) < new Date();

    return (
        <div
            className={`flex items-center justify-between p-3 rounded-lg ${
                editable ? 'bg-white/5' : 'bg-white/[0.02] opacity-70'
            } ${isPastDue ? 'border border-red-500/30' : ''}`}
        >
            <div className="flex items-center gap-3">
                {getChargeStatusIcon(charge.status)}
                <div>
                    <div className="font-medium flex items-center gap-2">
                        {formatCurrency(charge.amount)}
                        {index && totalPending && (
                            <span className="text-xs text-muted-foreground">
                                ({index} of {totalPending})
                            </span>
                        )}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                        Due: {format(new Date(charge.due_date), 'MMM d, yyyy')}
                        {isPastDue && (
                            <Badge variant="destructive" className="text-[10px] h-4 px-1">
                                Past Due
                            </Badge>
                        )}
                    </div>
                </div>
            </div>

            {editable ? (
                <div className="flex items-center gap-1">
                    <EditChargeDialog charge={charge} onSuccess={onUpdate}>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <Edit2 className="h-3 w-3" />
                        </Button>
                    </EditChargeDialog>
                    <CancelChargeDialog chargeId={charge.id} amount={charge.amount} onSuccess={onUpdate}>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                        >
                            <Trash2 className="h-3 w-3" />
                        </Button>
                    </CancelChargeDialog>
                </div>
            ) : (
                <Badge variant="secondary" className="capitalize">
                    {charge.status}
                </Badge>
            )}
        </div>
    );
}
