'use client'

import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import {
    HealthScoreResult,
    getHealthStatusBgColor,
    getHealthStatusLabel,
} from '@/lib/logic/client-health'

interface ClientHealthScoreProps {
    score: HealthScoreResult
    size?: 'sm' | 'default' | 'lg'
    showLabel?: boolean
}

export function ClientHealthScore({ score, size = 'default', showLabel = false }: ClientHealthScoreProps) {
    const sizeClasses = {
        sm: 'h-6 w-6 text-[10px]',
        default: 'h-8 w-8 text-xs',
        lg: 'h-12 w-12 text-sm',
    }

    const ringSize = {
        sm: 20,
        default: 28,
        lg: 44,
    }

    const strokeWidth = {
        sm: 2,
        default: 3,
        lg: 4,
    }

    const radius = (ringSize[size] - strokeWidth[size]) / 2
    const circumference = 2 * Math.PI * radius
    const progress = (score.score / 100) * circumference

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className={cn('flex items-center gap-2', showLabel && 'cursor-help')}>
                        <div className={cn('relative flex items-center justify-center', sizeClasses[size])}>
                            {/* Background ring */}
                            <svg
                                className="absolute inset-0 -rotate-90"
                                width={ringSize[size]}
                                height={ringSize[size]}
                            >
                                <circle
                                    cx={ringSize[size] / 2}
                                    cy={ringSize[size] / 2}
                                    r={radius}
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth={strokeWidth[size]}
                                    className="text-muted/30"
                                />
                                <circle
                                    cx={ringSize[size] / 2}
                                    cy={ringSize[size] / 2}
                                    r={radius}
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth={strokeWidth[size]}
                                    strokeDasharray={circumference}
                                    strokeDashoffset={circumference - progress}
                                    strokeLinecap="round"
                                    className={cn(
                                        'transition-all duration-500',
                                        getHealthStatusBgColor(score.score).replace('bg-', 'text-')
                                    )}
                                />
                            </svg>
                            {/* Score text */}
                            <span className={cn('font-semibold', score.color)}>
                                {score.score}
                            </span>
                        </div>
                        {showLabel && (
                            <span className={cn('text-sm font-medium', score.color)}>
                                {getHealthStatusLabel(score.score)}
                            </span>
                        )}
                    </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="w-64">
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="font-semibold">Health Score</span>
                            <span className={cn('font-bold', score.color)}>{score.score}/100</span>
                        </div>
                        <div className="space-y-1.5 text-xs">
                            <ScoreRow label="Payment Health" score={score.factors.paymentScore} weight="35%" />
                            <ScoreRow label="Onboarding Progress" score={score.factors.onboardingScore} weight="25%" />
                            <ScoreRow label="Contract Status" score={score.factors.contractScore} weight="20%" />
                            <ScoreRow label="Agreement Status" score={score.factors.agreementScore} weight="20%" />
                        </div>
                    </div>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}

function ScoreRow({ label, score, weight }: { label: string; score: number; weight: string }) {
    const color = score >= 80 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500'

    return (
        <div className="flex items-center gap-2">
            <span className="text-muted-foreground flex-1">{label}</span>
            <span className="text-muted-foreground/70 text-[10px]">{weight}</span>
            <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                <div
                    className={cn('h-full rounded-full transition-all', color)}
                    style={{ width: `${score}%` }}
                />
            </div>
            <span className="w-6 text-right font-medium">{score}</span>
        </div>
    )
}

// Simplified badge version for list view
export function HealthScoreBadge({ score }: { score: number }) {
    const color = score >= 80 ? 'text-emerald-500' : score >= 50 ? 'text-amber-500' : 'text-red-500'
    const bgColor = score >= 80 ? 'bg-emerald-500/10' : score >= 50 ? 'bg-amber-500/10' : 'bg-red-500/10'

    return (
        <span className={cn('text-xs font-semibold px-1.5 py-0.5 rounded', color, bgColor)}>
            {score}
        </span>
    )
}
