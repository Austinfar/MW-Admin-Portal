'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts'
import { TrendingUp } from 'lucide-react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

interface RevenueChartWidgetProps {
    monthlyRevenue: { name: string; total: number }[]
    delay?: number
}

export function RevenueChartWidget({ monthlyRevenue, delay = 0 }: RevenueChartWidgetProps) {
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
            <Card className="bg-zinc-900/40 backdrop-blur-xl border-white/5 shadow-2xl">
                <CardHeader className="flex flex-row items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-emerald-500/10 rounded-full">
                            <TrendingUp className="h-4 w-4 text-emerald-500" />
                        </div>
                        <div>
                            <CardTitle className="text-card-foreground">Revenue Overview</CardTitle>
                            <CardDescription className="text-muted-foreground">
                                Monthly revenue trends (Last 12 Months)
                            </CardDescription>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        className="h-8 text-xs text-muted-foreground hover:text-primary"
                    >
                        <Link href="/business">
                            View Details
                        </Link>
                    </Button>
                </CardHeader>
                <CardContent className="pl-2">
                    <div className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={monthlyRevenue}>
                                <defs>
                                    <linearGradient id="colorRevenueDash" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                                <XAxis
                                    dataKey="name"
                                    stroke="#71717a"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    stroke="#71717a"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#18181b',
                                        borderColor: '#27272a',
                                        color: '#fff',
                                        borderRadius: '8px'
                                    }}
                                    formatter={(value: number | undefined) => [
                                        formatCurrency(value || 0),
                                        'Revenue'
                                    ]}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="total"
                                    stroke="#10b981"
                                    fillOpacity={1}
                                    fill="url(#colorRevenueDash)"
                                    strokeWidth={2}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    )
}
