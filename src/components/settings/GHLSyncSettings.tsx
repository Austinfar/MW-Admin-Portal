'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { syncGHLPipeline } from '@/lib/actions/ghl';

interface Pipeline {
    id: string;
    name: string;
}

interface GHLSyncSettingsProps {
    pipelines: Pipeline[];
}

export function GHLSyncSettings({ pipelines }: GHLSyncSettingsProps) {
    const [selectedPipeline, setSelectedPipeline] = useState<string>('');
    const [isSyncing, setIsSyncing] = useState(false);

    const handleSync = async () => {
        if (!selectedPipeline) {
            toast.error('Please select a pipeline first');
            return;
        }

        setIsSyncing(true);
        toast.info('Starting pipeline sync...', { description: 'This may take a few moments.' });

        // Start polling immediately
        const pollInterval = setInterval(async () => {
            await checkStatus();
        }, 1000);

        try {
            const result = await syncGHLPipeline(selectedPipeline);

            if (result.error) {
                toast.error('Sync failed', { description: result.error });
            } else {
                toast.success('Sync completed!', {
                    description: `Processed ${result.count} contacts. ${result.errors} errors.`
                });
            }
        } catch (error) {
            toast.error('An unexpected error occurred during sync');
            console.error(error);
        } finally {
            clearInterval(pollInterval);
            await checkStatus(); // Final check
            setIsSyncing(false);
        }
    };

    const [syncStatus, setSyncStatus] = useState<any>(null);

    const checkStatus = async () => {
        try {
            const { getSyncStatus } = await import('@/lib/actions/app-settings');
            const status = await getSyncStatus();
            setSyncStatus(status);
        } catch (e) {
            console.error('Polling error', e);
        }
    };

    // Calculate progress percentage
    const percent = syncStatus?.total > 0 ? Math.round((syncStatus.processed / syncStatus.total) * 100) : 0;
    const showProgress = isSyncing || (syncStatus?.state === 'syncing');

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
                    <Select value={selectedPipeline} onValueChange={setSelectedPipeline}>
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

                {showProgress && (
                    <div className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Processing...</span>
                            <span>{syncStatus?.processed || 0} / {syncStatus?.total || '?'}</span>
                        </div>
                        <div className="h-2 w-full bg-secondary/20 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-primary transition-all duration-500 ease-out"
                                style={{ width: `${percent}%` }}
                            />
                        </div>
                    </div>
                )}
            </CardContent>
            <CardFooter>
                <Button onClick={handleSync} disabled={isSyncing || !selectedPipeline} className="w-full sm:w-auto">
                    {isSyncing ? 'Syncing...' : 'Sync Contacts'}
                </Button>
            </CardFooter>
        </Card>
    );
}
