'use client';

import { BusinessMetrics } from '@/lib/actions/analytics';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import { DollarSign, Users, CreditCard, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface BusinessDashboardProps {
    metrics: BusinessMetrics;
}

export function BusinessDashboard({ metrics }: BusinessDashboardProps) {

    // Helper to format currency
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
                <Card className="bg-card/50 backdrop-blur-sm border-primary/10">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Total Revenue
                        </CardTitle>
                        <DollarSign className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-card-foreground">{formatCurrency(metrics.totalRevenue)}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            LIFETIME EARNINGS
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-card/50 backdrop-blur-sm border-primary/10">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Active Clients
                        </CardTitle>
                        <Users className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-card-foreground">{metrics.activeClients}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            CURRENTLY ENROLLED
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-card/50 backdrop-blur-sm border-primary/10">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Avg. Transaction
                        </CardTitle>
                        <CreditCard className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-card-foreground">{formatCurrency(metrics.averagePayment)}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            PER PAYMENT
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-card/50 backdrop-blur-sm border-primary/10">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Success Rate
                        </CardTitle>
                        <TrendingUp className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        {/* Placeholder metric - calculate real success rate later */}
                        <div className="text-2xl font-bold text-card-foreground">98%</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            PAYMENT PROCESSING
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* CHART SECTION */}
            <div className="grid gap-4 md:grid-cols-7">
                <Card className="col-span-4 bg-card/40 border-primary/5">
                    <CardHeader>
                        <CardTitle className="text-card-foreground">Revenue Overview</CardTitle>
                        <CardDescription className="text-muted-foreground">Monthly revenue trends for the last 6 months.</CardDescription>
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

                {/* RECENT SALES LIST */}
                <Card className="col-span-3 bg-card/40 border-primary/5">
                    <CardHeader>
                        <CardTitle className="text-card-foreground">Recent Transactions</CardTitle>
                        <CardDescription className="text-muted-foreground">
                            Latest payments processed via Stripe.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {metrics.recentPayments.length === 0 && <div className="text-sm text-zinc-500">No transactions found.</div>}
                            {metrics.recentPayments.map((payment) => (
                                <div key={payment.id} className="flex items-center justify-between pb-4 border-b border-border/50 last:border-0 last:pb-0">
                                    <div className='flex flex-col gap-1'>
                                        <div className="font-medium text-card-foreground">
                                            {payment.client_email}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {new Date(payment.created_at).toLocaleDateString()}
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <div className="font-bold text-primary">
                                            +{formatCurrency(payment.amount / 100)}
                                        </div>
                                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-border text-muted-foreground">
                                            {payment.status}
                                        </Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

