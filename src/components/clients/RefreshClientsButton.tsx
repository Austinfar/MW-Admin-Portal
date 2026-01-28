'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'
import { refreshClientsData } from '@/lib/actions/revalidate'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export function RefreshClientsButton() {
    const [isRefreshing, setIsRefreshing] = useState(false)

    const handleRefresh = async () => {
        setIsRefreshing(true)
        try {
            await refreshClientsData()
            toast.success('Clients data refreshed')
        } catch (error) {
            console.error('Failed to refresh clients:', error)
            toast.error('Failed to refresh data')
        } finally {
            // Add a small delay to show the animation
            setTimeout(() => setIsRefreshing(false), 500)
        }
    }

    return (
        <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 hover:text-white transition-all"
            title="Refresh Clients Data"
        >
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
        </Button>
    )
}
