'use client'

import { AlertTriangle, CreditCard, Calendar, ListTodo } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { RiskIndicator } from '@/lib/logic/client-risk'

// Re-export for convenience
export type { RiskIndicator } from '@/lib/logic/client-risk'
export { calculateRiskIndicators } from '@/lib/logic/client-risk'

interface ClientRiskIndicatorsProps {
    indicators: RiskIndicator[]
    className?: string
}

const RISK_ICONS = {
    payment: CreditCard,
    engagement: ListTodo,
    contract: Calendar,
}

const RISK_COLORS = {
    warning: {
        badge: 'bg-amber-500/15 text-amber-500 border-amber-500/20',
        icon: 'text-amber-500',
    },
    critical: {
        badge: 'bg-red-500/15 text-red-500 border-red-500/20',
        icon: 'text-red-500',
    },
}

export function ClientRiskIndicators({ indicators, className }: ClientRiskIndicatorsProps) {
    if (!indicators || indicators.length === 0) {
        return null
    }

    return (
        <TooltipProvider>
            <div className={cn('flex items-center gap-1.5', className)}>
                {indicators.map((indicator, index) => {
                    const Icon = RISK_ICONS[indicator.type]
                    const colors = RISK_COLORS[indicator.severity]

                    return (
                        <Tooltip key={index}>
                            <TooltipTrigger asChild>
                                <Badge
                                    variant="secondary"
                                    className={cn(
                                        'px-1.5 py-0.5 gap-1 cursor-help',
                                        colors.badge
                                    )}
                                >
                                    <Icon className={cn('h-3 w-3', colors.icon)} />
                                </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p className="text-sm">{indicator.message}</p>
                            </TooltipContent>
                        </Tooltip>
                    )
                })}
            </div>
        </TooltipProvider>
    )
}

// Compact version showing just icons
export function RiskIndicatorIcons({ indicators }: { indicators: RiskIndicator[] }) {
    if (!indicators || indicators.length === 0) {
        return null
    }

    const hasCritical = indicators.some(i => i.severity === 'critical')

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className={cn(
                        'flex items-center gap-0.5 cursor-help',
                        hasCritical ? 'text-red-500' : 'text-amber-500'
                    )}>
                        <AlertTriangle className="h-4 w-4" />
                        {indicators.length > 1 && (
                            <span className="text-xs font-medium">{indicators.length}</span>
                        )}
                    </div>
                </TooltipTrigger>
                <TooltipContent>
                    <div className="space-y-1">
                        {indicators.map((indicator, index) => (
                            <p key={index} className="text-sm flex items-center gap-2">
                                <span className={cn(
                                    'w-1.5 h-1.5 rounded-full',
                                    indicator.severity === 'critical' ? 'bg-red-500' : 'bg-amber-500'
                                )} />
                                {indicator.message}
                            </p>
                        ))}
                    </div>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}
