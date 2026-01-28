'use client'

import { RefreshCw } from 'lucide-react'
import { refreshOnboardingData } from '@/lib/actions/revalidate'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function RefreshOnboardingButton() {
    const [isRefreshing, setIsRefreshing] = useState(false)

    const handleRefresh = async () => {
        setIsRefreshing(true)
        try {
            await refreshOnboardingData()
            toast.success('Onboarding data refreshed')
        } catch (error) {
            toast.error('Failed to refresh data')
        } finally {
            setIsRefreshing(false)
        }
    }

    return (
        <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="relative"
            title="Refresh Data"
        >
            <RefreshCw className={cn(
                "h-4 w-4",
                isRefreshing && "animate-spin"
            )} />
            <span className="sr-only">Refresh</span>
        </Button>
    )
}
