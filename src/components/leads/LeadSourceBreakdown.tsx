'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PieChart } from 'lucide-react'
import { motion } from 'framer-motion'
import { LeadSourceData } from '@/types/lead'
import { cn } from '@/lib/utils'

interface LeadSourceBreakdownProps {
    data: LeadSourceData[]
    onSourceClick?: (source: string | null) => void
    selectedSource?: string | null
    delay?: number
}

const SOURCE_COLORS: Record<string, { bar: string; text: string; bg: string }> = {
    'Web Form': { bar: 'bg-blue-500', text: 'text-blue-500', bg: 'bg-blue-500/10' },
    'GHL Pipeline': { bar: 'bg-purple-500', text: 'text-purple-500', bg: 'bg-purple-500/10' },
    'Manual': { bar: 'bg-gray-500', text: 'text-gray-400', bg: 'bg-gray-500/10' },
    'Referral': { bar: 'bg-green-500', text: 'text-green-500', bg: 'bg-green-500/10' },
    'Unknown': { bar: 'bg-amber-500', text: 'text-amber-500', bg: 'bg-amber-500/10' },
}

function getSourceColor(source: string) {
    return SOURCE_COLORS[source] || { bar: 'bg-zinc-500', text: 'text-zinc-400', bg: 'bg-zinc-500/10' }
}

export function LeadSourceBreakdown({
    data,
    onSourceClick,
    selectedSource,
    delay = 0
}: LeadSourceBreakdownProps) {
    const maxCount = Math.max(...data.map(d => d.count), 1)

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
                        <div className="p-2 bg-purple-500/10 rounded-full">
                            <PieChart className="h-4 w-4 text-purple-500" />
                        </div>
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Lead Sources
                        </CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="space-y-3">
                    {data.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                            No lead data available
                        </div>
                    ) : (
                        data.map((source, index) => {
                            const colors = getSourceColor(source.source)
                            const widthPercent = (source.count / maxCount) * 100

                            return (
                                <motion.div
                                    key={source.source}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: (delay * 0.1) + (index * 0.08) }}
                                    className={cn(
                                        "p-2 rounded-md transition-all cursor-pointer",
                                        selectedSource === source.source
                                            ? "bg-primary/10 ring-1 ring-primary/30"
                                            : "hover:bg-zinc-800/30"
                                    )}
                                    onClick={() => onSourceClick?.(selectedSource === source.source ? null : source.source)}
                                >
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className={cn("text-sm font-medium", colors.text)}>
                                            {source.source}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-bold text-foreground">
                                                {source.count}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                ({source.percentage}%)
                                            </span>
                                        </div>
                                    </div>
                                    <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                                        <motion.div
                                            className={cn('h-full rounded-full', colors.bar)}
                                            initial={{ width: 0 }}
                                            animate={{ width: `${widthPercent}%` }}
                                            transition={{
                                                duration: 0.6,
                                                delay: (delay * 0.1) + (index * 0.1)
                                            }}
                                        />
                                    </div>
                                </motion.div>
                            )
                        })
                    )}
                </CardContent>
            </Card>
        </motion.div>
    )
}
