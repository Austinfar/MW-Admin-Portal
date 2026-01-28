'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react' // Assuming lucide-react is available
import { refreshLeadsData } from '@/lib/actions/revalidate'
import { toast } from 'sonner' // Assuming sonner is used for toasts
import { cn } from '@/lib/utils'

export function RefreshLeadsButton() {
    const [isRefreshing, setIsRefreshing] = useState(false)

    const handleRefresh = async () => {
        setIsRefreshing(true)
        try {
            await refreshLeadsData()
            toast.success('Leads data refreshed')
        } catch (error) {
            console.error('Failed to refresh leads:', error)
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
            title="Refresh Leads Data"
        >
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
        </Button>
    )
}
