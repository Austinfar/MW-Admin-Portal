'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, DollarSign, Clock, TrendingUp, CalendarCheck, Wallet, AlertCircle, CheckCircle2 } from 'lucide-react';
import {
    getCommissionSummaryMetrics,
    getPayrollMetrics,
    getCommissionForecast,
    CommissionSummaryMetrics,
    PayrollMetrics,
} from '@/lib/actions/commission-analytics';
import { formatCurrency, cn } from '@/lib/utils';
import { CommissionLeaderboard } from './CommissionLeaderboard';
import { CommissionTrends } from './CommissionTrends';
import { CommissionBreakdown } from './CommissionBreakdown';

export function CommissionAnalyticsDashboard() {
    const [metrics, setMetrics] = useState<CommissionSummaryMetrics | null>(null);
    const [payrollMetrics, setPayrollMetrics] = useState<PayrollMetrics | null>(null);
    const [forecast, setForecast] = useState<{ scheduledPayments: number; estimatedCommissions: number; upcomingCount: number } | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchData() {
            setLoading(true);
            try {
                const [summaryResult, payrollResult, forecastResult] = await Promise.all([
                    getCommissionSummaryMetrics(),
                    getPayrollMetrics(),
                    getCommissionForecast()
                ]);
                setMetrics(summaryResult);
                setPayrollMetrics(payrollResult);
                setForecast(forecastResult);
            } catch (e) {
                console.error('Error fetching analytics:', e);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Summary Cards Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Paid */}
                <Card className="bg-card/40 border-white/5 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Paid Out</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-500">
                            {formatCurrency(metrics?.totalCommissionsPaid || 0)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Total commissions paid
                        </p>
                    </CardContent>
                </Card>

                {/* Pending */}
                <Card className="bg-card/40 border-white/5 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pending</CardTitle>
                        <Clock className="h-4 w-4 text-yellow-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-yellow-500">
                            {formatCurrency(metrics?.totalCommissionsPending || 0)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Awaiting payout
                        </p>
                    </CardContent>
                </Card>

                {/* Avg Per Deal */}
                <Card className="bg-card/40 border-white/5 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Avg / Deal</CardTitle>
                        <DollarSign className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-500">
                            {formatCurrency(metrics?.averageCommissionPerDeal || 0)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {metrics?.transactionCount || 0} transactions
                        </p>
                    </CardContent>
                </Card>

                {/* Commission Rate */}
                <Card className="bg-card/40 border-white/5 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Commission Rate</CardTitle>
                        <TrendingUp className="h-4 w-4 text-purple-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-purple-500">
                            {(metrics?.commissionAsPercentOfRevenue || 0).toFixed(1)}%
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Of gross revenue
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Payroll & Forecast Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Payroll Status */}
                <Card className="bg-card/40 border-white/5 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Wallet className="h-4 w-4 text-emerald-500" />
                            Payroll Status
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-4 gap-4">
                            <div className="text-center">
                                <div className="text-xl font-bold text-yellow-500">{payrollMetrics?.draftRuns || 0}</div>
                                <div className="text-xs text-muted-foreground">Draft</div>
                            </div>
                            <div className="text-center">
                                <div className="text-xl font-bold text-blue-500">{payrollMetrics?.approvedRuns || 0}</div>
                                <div className="text-xs text-muted-foreground">Approved</div>
                            </div>
                            <div className="text-center">
                                <div className="text-xl font-bold text-emerald-500">{payrollMetrics?.paidRuns || 0}</div>
                                <div className="text-xs text-muted-foreground">Paid</div>
                            </div>
                            <div className="text-center">
                                <div className="text-xl font-bold text-gray-500">{payrollMetrics?.voidedRuns || 0}</div>
                                <div className="text-xs text-muted-foreground">Voided</div>
                            </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Avg Approval Time</span>
                            <span className="font-medium">
                                {(payrollMetrics?.averageApprovalTime || 0).toFixed(1)} hours
                            </span>
                        </div>
                        <div className="flex justify-between items-center mt-2">
                            <span className="text-sm text-muted-foreground">Total Paid Out</span>
                            <span className="font-medium text-emerald-500">
                                {formatCurrency(payrollMetrics?.totalPaidOut || 0)}
                            </span>
                        </div>
                    </CardContent>
                </Card>

                {/* Forecast */}
                <Card className="bg-card/40 border-white/5 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <CalendarCheck className="h-4 w-4 text-emerald-500" />
                            3-Month Forecast
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Scheduled Payments</span>
                                <span className="font-medium">
                                    {formatCurrency(forecast?.scheduledPayments || 0)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Estimated Commissions</span>
                                <span className="font-medium text-emerald-500">
                                    {formatCurrency(forecast?.estimatedCommissions || 0)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Upcoming Charges</span>
                                <span className="font-medium">
                                    {forecast?.upcomingCount || 0}
                                </span>
                            </div>
                        </div>
                        {forecast && forecast.upcomingCount > 0 && (
                            <div className="mt-4 pt-4 border-t border-white/10">
                                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 text-center">
                                    <span className="text-sm text-emerald-400">
                                        Expected {formatCurrency(forecast.estimatedCommissions)} in commissions
                                    </span>
                                </div>
                            </div>
                        )}
                        {(!forecast || forecast.upcomingCount === 0) && (
                            <div className="mt-4 pt-4 border-t border-white/10">
                                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-center flex items-center justify-center gap-2">
                                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                                    <span className="text-sm text-yellow-400">
                                        No scheduled payments found
                                    </span>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <CommissionTrends months={6} />
                <CommissionBreakdown />
            </div>

            {/* Leaderboard */}
            <CommissionLeaderboard />
        </div>
    );
}
