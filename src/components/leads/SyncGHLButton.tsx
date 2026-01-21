'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { syncCallBookedLeads } from '@/lib/actions/ghl';
import { toast } from 'sonner';

export function SyncGHLButton() {
    const [isLoading, setIsLoading] = useState(false);

    const handleSync = async () => {
        setIsLoading(true);
        try {
            const result = await syncCallBookedLeads();

            if (result.success) {
                toast.success(`Synced ${result.count} contacts from GHL`);
            } else {
                toast.error(result.message || 'Failed to sync GHL contacts');
            }
        } catch (error) {
            console.error('Sync error:', error);
            toast.error('An unexpected error occurred during sync');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={isLoading}
            className="flex items-center gap-2"
        >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? 'Syncing...' : 'Sync GHL'}
        </Button>
    );
}
