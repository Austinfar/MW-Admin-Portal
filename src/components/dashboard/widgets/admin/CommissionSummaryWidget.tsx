'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DollarSign, ArrowRight, TrendingUp, Clock } from 'lucide-react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CommissionSummaryMetrics } from '@/lib/actions/commission-analytics'
import { cn } from '@/lib/utils'

interface CommissionSummaryWidgetProps {
    summary: CommissionSummaryMetrics
    delay?: number
}

export function CommissionSummaryWidget({ summary, delay = 0 }: CommissionSummaryWidgetProps) {
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount)
    }

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
                        <div className="p-2 bg-orange-500/10 rounded-full">
                            <DollarSign className="h-4 w-4 text-orange-500" />
                        </div>
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Commission Summary
                        </CardTitle>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        className="h-8 text-xs text-muted-foreground hover:text-primary"
                    >
                        <Link href="/commissions">
                            View All
                            <ArrowRight className="h-3 w-3 ml-1" />
                        </Link>
                    </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Paid vs Pending */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <TrendingUp className="h-3 w-3 text-green-500" />
                                Paid
                            </div>
                            <div className="text-xl font-bold text-green-500">
                                {formatCurrency(summary.totalCommissionsPaid)}
                            </div>
                        </div>
                        <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3 text-amber-500" />
                                Pending
                            </div>
                            <div className="text-xl font-bold text-amber-500">
                                {formatCurrency(summary.totalCommissionsPending)}
                            </div>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="pt-3 border-t border-border/50 space-y-2">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Avg per Deal</span>
                            <span className="font-medium">
                                {formatCurrency(summary.averageCommissionPerDeal)}
                            </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">% of Revenue</span>
                            <span className="font-medium">
                                {summary.commissionAsPercentOfRevenue.toFixed(1)}%
                            </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Transactions</span>
                            <span className="font-medium">{summary.transactionCount}</span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    )
}
