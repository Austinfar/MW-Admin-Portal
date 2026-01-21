'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, TrendingUp, BarChart3 } from 'lucide-react';
import { getCommissionTrends, MonthlyTrend } from '@/lib/actions/commission-analytics';
import { formatCurrency, cn } from '@/lib/utils';

interface Props {
    months?: number;
}

export function CommissionTrends({ months = 6 }: Props) {
    const [data, setData] = useState<MonthlyTrend[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'commission' | 'gross'>('commission');

    useEffect(() => {
        async function fetchData() {
            setLoading(true);
            try {
                const result = await getCommissionTrends(months);
                setData(result);
            } catch (e) {
                console.error('Error fetching trends:', e);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [months]);

    const maxValue = Math.max(
        ...data.map(d => viewMode === 'commission' ? d.totalCommission : d.totalGross),
        1 // Prevent division by zero
    );

    const totalCommission = data.reduce((sum, d) => sum + d.totalCommission, 0);
    const totalGross = data.reduce((sum, d) => sum + d.totalGross, 0);
    const totalTransactions = data.reduce((sum, d) => sum + d.transactionCount, 0);

    // Calculate trend (comparing last 2 months)
    const lastMonth = data[data.length - 1];
    const prevMonth = data[data.length - 2];
    const trend = lastMonth && prevMonth
        ? ((lastMonth.totalCommission - prevMonth.totalCommission) / (prevMonth.totalCommission || 1)) * 100
        : 0;

    return (
        <Card className="bg-card/40 border-white/5 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-emerald-500" />
                    Commission Trends
                </CardTitle>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setViewMode('commission')}
                        className={cn(
                            "px-2 py-1 text-xs rounded-md transition-colors",
                            viewMode === 'commission'
                                ? "bg-emerald-500/20 text-emerald-400"
                                : "text-muted-foreground hover:text-white"
                        )}
                    >
                        Commission
                    </button>
                    <button
                        onClick={() => setViewMode('gross')}
                        className={cn(
                            "px-2 py-1 text-xs rounded-md transition-colors",
                            viewMode === 'gross'
                                ? "bg-blue-500/20 text-blue-400"
                                : "text-muted-foreground hover:text-white"
                        )}
                    >
                        Gross
                    </button>
                </div>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : data.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                        No commission data available
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Summary stats */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-white/5 rounded-lg p-3 text-center">
                                <div className="text-2xl font-bold text-emerald-500">
                                    {formatCurrency(totalCommission)}
                                </div>
                                <div className="text-xs text-muted-foreground">Total Commission</div>
                            </div>
                            <div className="bg-white/5 rounded-lg p-3 text-center">
                                <div className="text-2xl font-bold text-blue-500">
                                    {formatCurrency(totalGross)}
                                </div>
                                <div className="text-xs text-muted-foreground">Total Gross</div>
                            </div>
                            <div className="bg-white/5 rounded-lg p-3 text-center">
                                <div className={cn(
                                    "text-2xl font-bold flex items-center justify-center gap-1",
                                    trend >= 0 ? "text-emerald-500" : "text-red-500"
                                )}>
                                    <TrendingUp className={cn(
                                        "h-5 w-5",
                                        trend < 0 && "rotate-180"
                                    )} />
                                    {Math.abs(trend).toFixed(1)}%
                                </div>
                                <div className="text-xs text-muted-foreground">vs Last Month</div>
                            </div>
                        </div>

                        {/* Bar chart */}
                        <div className="h-48 flex items-end gap-2">
                            {data.map((month, index) => {
                                const value = viewMode === 'commission' ? month.totalCommission : month.totalGross;
                                const height = (value / maxValue) * 100;

                                return (
                                    <div
                                        key={`${month.year}-${month.month}`}
                                        className="flex-1 flex flex-col items-center gap-1"
                                    >
                                        <div className="relative w-full flex justify-center">
                                            <div
                                                className={cn(
                                                    "w-full max-w-8 rounded-t-md transition-all duration-500",
                                                    viewMode === 'commission'
                                                        ? "bg-gradient-to-t from-emerald-600 to-emerald-400"
                                                        : "bg-gradient-to-t from-blue-600 to-blue-400",
                                                    index === data.length - 1 && "opacity-100",
                                                    index !== data.length - 1 && "opacity-70"
                                                )}
                                                style={{ height: `${Math.max(height, 4)}%` }}
                                            />
                                            {/* Tooltip on hover */}
                                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#1a1a1a] px-2 py-1 rounded text-xs whitespace-nowrap opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
                                                {formatCurrency(value)}
                                            </div>
                                        </div>
                                        <span className="text-xs text-muted-foreground">
                                            {month.month}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Transaction count */}
                        <div className="text-center text-sm text-muted-foreground">
                            {totalTransactions} transactions over {data.length} months
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
