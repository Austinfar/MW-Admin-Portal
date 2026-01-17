'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { syncGHLPipeline } from '@/lib/actions/ghl';
import { getSyncStatus } from '@/lib/actions/app-settings';
import { Loader2, CheckCircle2, AlertCircle, Users } from 'lucide-react';

interface Pipeline {
    id: string;
    name: string;
}

interface GHLSyncSettingsProps {
    pipelines: Pipeline[];
}

interface SyncStatus {
    state: 'idle' | 'syncing' | 'completed' | 'error';
    total: number;
    processed: number;
    synced: number;
    matched_stripe?: number;
    unmatched_stripe?: number;
    errors: number;
    last_updated: string;
}

export function GHLSyncSettings({ pipelines }: GHLSyncSettingsProps) {
    const [selectedPipeline, setSelectedPipeline] = useState<string>('');
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
    const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const checkStatus = async () => {
        try {
            // We call the server action directly. Next.js actions are usually POST and not cached like GET,
            // but let's make sure we are getting fresh data.
            const status = await getSyncStatus();
            setSyncStatus(status);
        } catch (e) {
            console.error('Polling error', e);
        }
    };

    // Start polling when syncing begins
    useEffect(() => {
        if (isSyncing) {
            // Poll every 500ms for more responsive updates
            pollIntervalRef.current = setInterval(checkStatus, 500);
            // Initial check
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
    }, [isSyncing]);

    const handleSync = async () => {
        if (!selectedPipeline) {
            toast.error('Please select a pipeline first');
            return;
        }

        setIsSyncing(true);
        setSyncStatus({ state: 'syncing', total: 0, processed: 0, synced: 0, errors: 0, last_updated: new Date().toISOString() });

        try {
            const result = await syncGHLPipeline(selectedPipeline);

            if (result.error) {
                toast.error('Sync failed', { description: result.error });
            } else {
                toast.success('Sync completed!', {
                    description: `Successfully synced ${result.count} contacts. ${result.errors} errors.`
                });
            }
        } catch (error) {
            toast.error('An unexpected error occurred during sync');
            console.error(error);
        } finally {
            await checkStatus(); // Final status check
            setIsSyncing(false);
        }
    };

    // Calculate progress percentage
    const percent = (syncStatus && syncStatus.total > 0) ? Math.round((syncStatus.processed / syncStatus.total) * 100) : 0;
    const showProgress = isSyncing || syncStatus?.state === 'syncing';
    const isCompleted = syncStatus?.state === 'completed';
    const hasErrors = (syncStatus?.errors || 0) > 0;

    return (
        <Card className="bg-card/40 border-primary/5">
            <CardHeader>
                <CardTitle>GoHighLevel Import</CardTitle>
                <CardDescription>
                    Import contacts directly from a specific GHL Pipeline. This will create or update client records.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="pipeline">Select Pipeline</Label>
                    <Select value={selectedPipeline} onValueChange={setSelectedPipeline} disabled={isSyncing}>
                        <SelectTrigger id="pipeline">
                            <SelectValue placeholder="Select a pipeline..." />
                        </SelectTrigger>
                        <SelectContent>
                            {pipelines.length === 0 ? (
                                <SelectItem value="none" disabled>No pipelines found</SelectItem>
                            ) : (
                                pipelines.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>
                                        {p.name}
                                    </SelectItem>
                                ))
                            )}
                        </SelectContent>
                    </Select>
                </div>

                {/* Real-time Progress Display */}
                {showProgress && (
                    <div className="space-y-3 p-4 rounded-lg bg-primary/5 border border-primary/10">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                <span className="text-sm font-medium">Syncing contacts...</span>
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
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-1.5">
                                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                                        <span className="text-muted-foreground">Processed:</span>
                                        <span className="font-semibold text-foreground">
                                            {syncStatus?.processed || 0}
                                        </span>
                                        <span className="text-muted-foreground">
                                            / {syncStatus?.total || '...'}
                                        </span>
                                    </div>
                                    {hasErrors && (
                                        <div className="flex items-center gap-1.5 text-destructive">
                                            <AlertCircle className="h-3.5 w-3.5" />
                                            <span>{syncStatus?.errors} errors</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Detailed Breakdown */}
                            <div className="flex items-center gap-4 text-xs pt-1 border-t border-border/40">
                                <div className="flex items-center gap-1.5" title="Clients linked to Stripe">
                                    <div className="h-2 w-2 rounded-full bg-emerald-500" />
                                    <span className="text-muted-foreground">Stripe Matched:</span>
                                    <span className="font-semibold text-emerald-500">
                                        {syncStatus?.matched_stripe || 0}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1.5" title="Clients synced but not in Stripe">
                                    <div className="h-2 w-2 rounded-full bg-amber-500" />
                                    <span className="text-muted-foreground">Unmatched:</span>
                                    <span className="font-semibold text-amber-500">
                                        {syncStatus?.unmatched_stripe || 0}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Completion Status */}
                {!showProgress && isCompleted && syncStatus && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="text-sm">
                            Last sync: <strong>{syncStatus.synced || 0}</strong> contacts synced
                            {hasErrors && ` (${syncStatus.errors} failed)`}
                        </span>
                    </div>
                )}
            </CardContent>
            <CardFooter>
                <Button onClick={handleSync} disabled={isSyncing || !selectedPipeline} className="w-full sm:w-auto">
                    {isSyncing ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Syncing...
                        </>
                    ) : (
                        'Sync Contacts'
                    )}
                </Button>
            </CardFooter>
        </Card>
    );
}
