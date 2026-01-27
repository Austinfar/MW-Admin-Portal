'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Target, UserCheck, Calendar, FileText, Trophy } from 'lucide-react'
import { motion } from 'framer-motion'
import { LeadFunnelData } from '@/types/lead'
import { cn } from '@/lib/utils'

interface LeadPipelineFunnelProps {
    data: LeadFunnelData
    onPeriodChange?: (period: '7d' | '30d' | 'all') => void
    onStageClick?: (stage: string | null) => void
    selectedStage?: string | null
    delay?: number
}

const PERIODS = [
    { value: '7d' as const, label: '7d' },
    { value: '30d' as const, label: '30d' },
    { value: 'all' as const, label: 'All' },
]

export function LeadPipelineFunnel({
    data,
    onPeriodChange,
    onStageClick,
    selectedStage,
    delay = 0
}: LeadPipelineFunnelProps) {
    const [activePeriod, setActivePeriod] = useState<'7d' | '30d' | 'all'>(data.period)

    const handlePeriodChange = (period: '7d' | '30d' | 'all') => {
        setActivePeriod(period)
        onPeriodChange?.(period)
    }

    const stages = [
        {
            key: 'contacts',
            label: 'Contacts',
            value: data.contactsSubmitted,
            icon: Target,
            color: 'text-cyan-500',
            bgColor: 'bg-cyan-500/10',
            barColor: 'bg-cyan-500',
            percentage: 100
        },
        {
            key: 'coach',
            label: 'Coach Selected',
            value: data.coachSelected,
            icon: UserCheck,
            color: 'text-blue-500',
            bgColor: 'bg-blue-500/10',
            barColor: 'bg-blue-500',
            percentage: data.contactsSubmitted > 0 ? (data.coachSelected / data.contactsSubmitted) * 100 : 0
        },
        {
            key: 'booked',
            label: 'Call Booked',
            value: data.callBooked,
            icon: Calendar,
            color: 'text-purple-500',
            bgColor: 'bg-purple-500/10',
            barColor: 'bg-purple-500',
            percentage: data.contactsSubmitted > 0 ? (data.callBooked / data.contactsSubmitted) * 100 : 0
        },
        {
            key: 'questionnaire',
            label: 'Questionnaire',
            value: data.questionnaireDone,
            icon: FileText,
            color: 'text-green-500',
            bgColor: 'bg-green-500/10',
            barColor: 'bg-green-500',
            percentage: data.contactsSubmitted > 0 ? (data.questionnaireDone / data.contactsSubmitted) * 100 : 0
        },
        {
            key: 'won',
            label: 'Closed Won',
            value: data.closedWon,
            icon: Trophy,
            color: 'text-neon-green',
            bgColor: 'bg-neon-green/10',
            barColor: 'bg-neon-green',
            percentage: data.contactsSubmitted > 0 ? (data.closedWon / data.contactsSubmitted) * 100 : 0
        }
    ]

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
                duration: 0.4,
                delay: delay * 0.1,
                ease: [0.25, 0.46, 0.45, 0.94]
            }}
            className="h-full"
        >
            <Card className="bg-zinc-900/40 backdrop-blur-xl border-white/5 shadow-2xl hover:border-white/10 transition-all duration-300 h-full">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-blue-500/10 rounded-full">
                            <Target className="h-4 w-4 text-blue-500" />
                        </div>
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Lead Pipeline
                        </CardTitle>
                    </div>
                    <div className="flex items-center gap-1 bg-zinc-800/50 rounded-md p-0.5">
                        {PERIODS.map(period => (
                            <Button
                                key={period.value}
                                variant="ghost"
                                size="sm"
                                onClick={() => handlePeriodChange(period.value)}
                                className={cn(
                                    "h-6 px-2 text-xs transition-all",
                                    activePeriod === period.value
                                        ? "bg-primary text-primary-foreground"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                {period.label}
                            </Button>
                        ))}
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-3">
                        {stages.map((stage, index) => (
                            <motion.div
                                key={stage.key}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: (delay * 0.1) + (index * 0.1) }}
                                className={cn(
                                    "space-y-1.5 p-2 rounded-md transition-all cursor-pointer",
                                    selectedStage === stage.key
                                        ? "bg-primary/10 ring-1 ring-primary/30"
                                        : "hover:bg-zinc-800/30"
                                )}
                                onClick={() => onStageClick?.(selectedStage === stage.key ? null : stage.key)}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className={cn('p-1 rounded', stage.bgColor)}>
                                            <stage.icon className={cn('h-3 w-3', stage.color)} />
                                        </div>
                                        <span className="text-sm text-muted-foreground">
                                            {stage.label}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={cn('text-lg font-bold', stage.color)}>
                                            {stage.value}
                                        </span>
                                        {index > 0 && (
                                            <span className="text-xs text-muted-foreground">
                                                ({Math.round(stage.percentage)}%)
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                                    <motion.div
                                        className={cn('h-full rounded-full', stage.barColor)}
                                        initial={{ width: 0 }}
                                        animate={{ width: `${stage.percentage}%` }}
                                        transition={{
                                            duration: 0.8,
                                            delay: (delay * 0.1) + (index * 0.15)
                                        }}
                                    />
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    <div className="pt-3 border-t border-border/50">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">
                                Conversion Rate
                            </span>
                            <span className="text-lg font-bold text-neon-green">
                                {data.conversionRate.toFixed(1)}%
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {activePeriod === '7d' ? 'Last 7 days' : activePeriod === '30d' ? 'Last 30 days' : 'All time'}
                        </p>
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    )
}
