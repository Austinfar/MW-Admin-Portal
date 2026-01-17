'use client';

import { BusinessMetrics } from '@/lib/actions/analytics';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import { DollarSign, Users, CreditCard, TrendingUp, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { TransactionDetailsDialog } from './TransactionDetailsDialog';

interface BusinessDashboardProps {
    metrics: BusinessMetrics;
}

export function BusinessDashboard({ metrics }: BusinessDashboardProps) {

    // Helper to format currency
    // Note: Aggregates from analytics.ts are in Dollars. 
    // Individual payments from DB are in Cents.
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
        }).format(amount);
    };

    return (
        <div className="space-y-8">
            {/* KPI GRID */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-card/50 backdrop-blur-sm border-primary/10 transition-all hover:bg-card/60">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            2026 Forecast
                        </CardTitle>
                        <TrendingUp className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-card-foreground">
                            {formatCurrency(metrics.forecastedRevenue)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            CALENDAR YEAR PROJECTED
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-card/50 backdrop-blur-sm border-primary/10 transition-all hover:bg-card/60">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            MRR
                        </CardTitle>
                        <CreditCard className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-card-foreground">
                            {formatCurrency(metrics.mrr)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            MONTHLY RECURRING REVENUE
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-card/50 backdrop-blur-sm border-primary/10 transition-all hover:bg-card/60">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Active Subs
                        </CardTitle>
                        <Users className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-card-foreground">{metrics.activeSubscriptions}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {metrics.churnedSubscriptions} CHURNED (30d)
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-card/50 backdrop-blur-sm border-primary/10 transition-all hover:bg-card/60">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Avg. Transaction
                        </CardTitle>
                        <DollarSign className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-card-foreground">
                            {formatCurrency(metrics.averagePayment)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            PER SUCCESSFUL PAYMENT
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* CHART SECTION */}
            <div className="grid gap-4 md:grid-cols-7">
                <Card className="col-span-4 bg-card/40 border-primary/5">
                    <CardHeader>
                        <CardTitle className="text-card-foreground">Revenue Overview</CardTitle>
                        <CardDescription className="text-muted-foreground">Monthly revenue trends (Last 12 Months).</CardDescription>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <div className="h-[350px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={metrics.monthlyRevenue}>
                                    <defs>
                                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
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
                                        tickFormatter={(value) => `$${value}`}
                                    />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', color: '#fff' }}
                                        formatter={(value: number | undefined) => [`$${(value || 0).toFixed(2)}`, 'Revenue']}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="total"
                                        stroke="#10b981"
                                        fillOpacity={1}
                                        fill="url(#colorRevenue)"
                                        strokeWidth={2}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* RECENT SALES & FAILED PAYMENTS */}
                <div className="col-span-3 space-y-4">
                    {/* Failed Payments Alert Section */}
                    {metrics.failedPayments.length > 0 && (
                        <Card className="bg-red-950/20 border-red-500/20 shadow-sm shadow-red-900/10">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-red-500 text-sm font-semibold flex items-center gap-2">
                                    <AlertCircle className="h-4 w-4 animate-pulse" />
                                    Failed Payments (Action Needed)
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {metrics.failedPayments.map((payment) => (
                                        <TransactionDetailsDialog key={payment.id} payment={payment}>
                                            <div className="flex items-center justify-between text-sm cursor-pointer hover:bg-red-500/5 p-2 rounded-md transition-colors">
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-red-400 truncate max-w-[150px]">
                                                        {payment.client_email || 'Unknown Client'}
                                                    </span>
                                                    <span className="text-xs text-red-500/60">
                                                        {new Date(payment.payment_date || payment.created_at).toLocaleDateString()}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-red-400">
                                                        {formatCurrency(payment.amount)}
                                                    </span>
                                                    <Badge variant="outline" className="text-[10px] h-5 border-red-500/30 text-red-400 bg-red-500/10">
                                                        Failed
                                                    </Badge>
                                                </div>
                                            </div>
                                        </TransactionDetailsDialog>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    <Card className="bg-card/40 border-primary/5 h-full">
                        <CardHeader>
                            <CardTitle className="text-card-foreground">Recent Transactions</CardTitle>
                            <CardDescription className="text-muted-foreground">
                                Latest payments processed via Stripe.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {metrics.recentPayments.length === 0 && <div className="text-sm text-zinc-500 py-4 text-center">No transactions found.</div>}
                                {metrics.recentPayments.map((payment) => (
                                    <TransactionDetailsDialog key={payment.id} payment={payment}>
                                        <div className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors group">
                                            <div className='flex flex-col gap-1'>
                                                <div className="font-medium text-card-foreground group-hover:text-primary transition-colors truncate max-w-[140px]">
                                                    {payment.clients?.name || payment.client_email || 'Unknown Client'}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {new Date(payment.payment_date || payment.created_at).toLocaleDateString()}
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-1">
                                                <div className="font-bold text-card-foreground">
                                                    {payment.status === 'succeeded' ? '+' : ''}
                                                    {formatCurrency(payment.amount)}
                                                </div>
                                                <Badge
                                                    variant="outline"
                                                    className={`text-[10px] px-1 py-0 h-4 border-border 
                                                        ${payment.status === 'succeeded' ? 'text-green-500 border-green-500/20 bg-green-500/10' : 'text-muted-foreground'}
                                                    `}
                                                >
                                                    {payment.status}
                                                </Badge>
                                            </div>
                                        </div>
                                    </TransactionDetailsDialog>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
