'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Target, ArrowRight, Calendar, Users, CheckCircle } from 'lucide-react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { SalesFunnelData } from '@/lib/actions/dashboard-data'
import { cn } from '@/lib/utils'

interface FunnelWidgetProps {
    funnel: SalesFunnelData
    delay?: number
}

export function FunnelWidget({ funnel, delay = 0 }: FunnelWidgetProps) {
    const stages = [
        {
            label: 'Booked',
            value: funnel.booked,
            icon: Calendar,
            color: 'text-cyan-500',
            bgColor: 'bg-cyan-500/10',
            barColor: 'bg-cyan-500',
            percentage: 100
        },
        {
            label: 'Showed',
            value: funnel.showed,
            icon: Users,
            color: 'text-blue-500',
            bgColor: 'bg-blue-500/10',
            barColor: 'bg-blue-500',
            percentage: funnel.booked > 0 ? (funnel.showed / funnel.booked) * 100 : 0
        },
        {
            label: 'Closed',
            value: funnel.closed,
            icon: CheckCircle,
            color: 'text-green-500',
            bgColor: 'bg-green-500/10',
            barColor: 'bg-green-500',
            percentage: funnel.booked > 0 ? (funnel.closed / funnel.booked) * 100 : 0
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
        >
            <Card className="bg-card/50 backdrop-blur-sm border-primary/10 hover:border-primary/30 transition-all duration-300">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-blue-500/10 rounded-full">
                            <Target className="h-4 w-4 text-blue-500" />
                        </div>
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Sales Funnel
                        </CardTitle>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        className="h-8 text-xs text-muted-foreground hover:text-primary"
                    >
                        <Link href="/sales-floor">
                            View Floor
                            <ArrowRight className="h-3 w-3 ml-1" />
                        </Link>
                    </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Funnel Stages */}
                    <div className="space-y-3">
                        {stages.map((stage, index) => (
                            <motion.div
                                key={stage.label}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: (delay * 0.1) + (index * 0.1) }}
                                className="space-y-1.5"
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
                                    <span className={cn('text-lg font-bold', stage.color)}>
                                        {stage.value}
                                    </span>
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

                    {/* Conversion Rate */}
                    <div className="pt-3 border-t border-border/50">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">
                                Conversion Rate
                            </span>
                            <span className="text-lg font-bold text-green-500">
                                {funnel.conversionRate.toFixed(1)}%
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Last 30 days
                        </p>
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    )
}
