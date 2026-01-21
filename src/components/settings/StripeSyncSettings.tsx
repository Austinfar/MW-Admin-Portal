'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, AlertCircle, Users, CreditCard, Receipt, DollarSign, History } from 'lucide-react';
import { syncAllClientsWithStripe, syncStripePayments, getStripeSyncStatus, backfillStripeFees, fullStripeBackfill } from '@/lib/actions/stripe-sync';

interface SyncStatus {
    state: 'idle' | 'syncing' | 'completed' | 'error';
    total: number;
    processed: number;
    synced: number;
    errors: number;
    last_updated: string;
}

export function StripeSyncSettings() {
    const [isSyncingClients, setIsSyncingClients] = useState(false);
    const [isSyncingPayments, setIsSyncingPayments] = useState(false);
    const [isBackfillingFees, setIsBackfillingFees] = useState(false);
    const [isFullBackfill, setIsFullBackfill] = useState(false);
    const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
    const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const isAnyOperationRunning = isSyncingClients || isSyncingPayments || isBackfillingFees || isFullBackfill;

    const checkStatus = async () => {
        try {
            const status = await getStripeSyncStatus();
            setSyncStatus(status);
        } catch (e) {
            console.error('Polling error', e);
        }
    };

    // Start polling when any sync operation begins
    useEffect(() => {
        if (isAnyOperationRunning) {
            pollIntervalRef.current = setInterval(checkStatus, 500);
            checkStatus();
        } else {
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
            }
        }

        return () => {
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
            }
        };
    }, [isAnyOperationRunning]);

    const handleSyncClients = async () => {
        setIsSyncingClients(true);
        setSyncStatus({ state: 'syncing', total: 0, processed: 0, synced: 0, errors: 0, last_updated: new Date().toISOString() });

        try {
            const result = await syncAllClientsWithStripe();

            if (result.error) {
                toast.error('Sync failed', { description: result.error });
            } else {
                toast.success('Stripe sync completed!', {
                    description: `Found ${result.synced} Stripe customers. ${result.linked} newly linked.`
                });
            }
        } catch (error) {
            toast.error('An unexpected error occurred during sync');
            console.error(error);
        } finally {
            await checkStatus();
            setIsSyncingClients(false);
        }
    };

    const handleSyncPayments = async () => {
        setIsSyncingPayments(true);

        try {
            const result = await syncStripePayments(30);

            if (result.error) {
                toast.error('Payment sync failed', { description: result.error || 'Unknown error' });
            } else {
                toast.success('Payment sync completed!', {
                    description: `Synced ${result.synced} payments. ${result.linked} linked to clients.`
                });
            }
        } catch (error) {
            toast.error('An unexpected error occurred');
            console.error(error);
        } finally {
            setIsSyncingPayments(false);
        }
    };

    const handleBackfillFees = async () => {
        setIsBackfillingFees(true);
        setSyncStatus({ state: 'syncing', total: 0, processed: 0, synced: 0, errors: 0, last_updated: new Date().toISOString() });

        try {
            const result = await backfillStripeFees();

            if (result.error) {
                toast.error('Fee backfill failed', { description: result.error });
            } else {
                toast.success('Fee backfill completed!', {
                    description: `Updated ${result.updated} payments with actual Stripe fees. ${result.skipped} already correct.`
                });
            }
        } catch (error) {
            toast.error('An unexpected error occurred');
            console.error(error);
        } finally {
            await checkStatus();
            setIsBackfillingFees(false);
        }
    };

    const handleFullBackfill = async () => {
        setIsFullBackfill(true);
        setSyncStatus({ state: 'syncing', total: 0, processed: 0, synced: 0, errors: 0, last_updated: new Date().toISOString() });

        try {
            const result = await fullStripeBackfill();

            if (!result.success) {
                toast.error('Full backfill failed', { description: `${result.errors} errors occurred` });
            } else {
                toast.success('Full backfill completed!', {
                    description: `Imported ${result.synced} payments. ${result.linked} linked to clients, ${result.orphaned} need review.`
                });
            }
        } catch (error) {
            toast.error('An unexpected error occurred');
            console.error(error);
        } finally {
            await checkStatus();
            setIsFullBackfill(false);
        }
    };

    // Calculate progress
    const percent = (syncStatus && syncStatus.total > 0) ? Math.round((syncStatus.processed / syncStatus.total) * 100) : 0;
    const showProgress = isAnyOperationRunning || syncStatus?.state === 'syncing';
    const isCompleted = syncStatus?.state === 'completed';
    const hasErrors = (syncStatus?.errors || 0) > 0;

    // Determine current operation label
    const getOperationLabel = () => {
        if (isSyncingClients) return 'Syncing customers with Stripe...';
        if (isSyncingPayments) return 'Syncing payments...';
        if (isBackfillingFees) return 'Backfilling Stripe fees...';
        if (isFullBackfill) return 'Running full 12-month backfill...';
        return 'Syncing with Stripe...';
    };

    return (
        <Card className="bg-card/40 border-primary/5">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Stripe Sync
                </CardTitle>
                <CardDescription>
                    Link clients to their Stripe customer accounts and sync payment history.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Real-time Progress Display */}
                {showProgress && (
                    <div className="space-y-3 p-4 rounded-lg bg-primary/5 border border-primary/10">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                <span className="text-sm font-medium">{getOperationLabel()}</span>
                            </div>
                            <span className="text-sm font-mono text-primary">
                                {percent}%
                            </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="h-2 w-full bg-secondary/30 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-primary transition-all duration-300 ease-out"
                                style={{ width: `${percent}%` }}
                            />
                        </div>

                        {/* Stats */}
                        <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-1.5">
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                    <span className="text-muted-foreground">Found:</span>
                                    <span className="font-semibold text-emerald-500">
                                        {syncStatus?.synced || 0}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="text-muted-foreground">Checked:</span>
                                    <span className="font-semibold text-foreground">
                                        {syncStatus?.processed || 0}
                                    </span>
                                    <span className="text-muted-foreground">
                                        / {syncStatus?.total || '...'}
                                    </span>
                                </div>
                            </div>
                            {hasErrors && (
                                <div className="flex items-center gap-1.5 text-destructive">
                                    <AlertCircle className="h-3.5 w-3.5" />
                                    <span>{syncStatus?.errors} errors</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Completion Status */}
                {!showProgress && isCompleted && syncStatus && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="text-sm">
                            Last sync: <strong>{syncStatus.synced || 0}</strong> Stripe customers found
                            {hasErrors && ` (${syncStatus.errors} errors)`}
                        </span>
                    </div>
                )}

                <div className="text-sm text-muted-foreground space-y-1">
                    <p><strong>Sync Customers:</strong> Looks up each client's email in Stripe and links their Stripe customer ID.</p>
                    <p><strong>Sync Payments:</strong> Imports the last 30 days of payments from Stripe.</p>
                    <p><strong>Backfill Fees:</strong> Updates existing payments with actual Stripe fees (replaces estimated fees).</p>
                    <p><strong>Full Backfill:</strong> Imports all payments from the last 12 months with actual fees.</p>
                </div>
            </CardContent>
            <CardFooter className="gap-2 flex-wrap">
                <Button
                    onClick={handleSyncClients}
                    disabled={isAnyOperationRunning}
                    className="gap-2"
                >
                    {isSyncingClients ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Syncing Customers...
                        </>
                    ) : (
                        <>
                            <Users className="h-4 w-4" />
                            Sync Customers
                        </>
                    )}
                </Button>
                <Button
                    variant="outline"
                    onClick={handleSyncPayments}
                    disabled={isAnyOperationRunning}
                    className="gap-2"
                >
                    {isSyncingPayments ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Syncing Payments...
                        </>
                    ) : (
                        <>
                            <Receipt className="h-4 w-4" />
                            Sync Payments (30 days)
                        </>
                    )}
                </Button>
                <Button
                    variant="outline"
                    onClick={handleBackfillFees}
                    disabled={isAnyOperationRunning}
                    className="gap-2"
                >
                    {isBackfillingFees ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Backfilling Fees...
                        </>
                    ) : (
                        <>
                            <DollarSign className="h-4 w-4" />
                            Backfill Fees
                        </>
                    )}
                </Button>
                <Button
                    variant="outline"
                    onClick={handleFullBackfill}
                    disabled={isAnyOperationRunning}
                    className="gap-2"
                >
                    {isFullBackfill ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Running Full Backfill...
                        </>
                    ) : (
                        <>
                            <History className="h-4 w-4" />
                            Full Backfill (12 mo)
                        </>
                    )}
                </Button>
            </CardFooter>
        </Card>
    );
}
