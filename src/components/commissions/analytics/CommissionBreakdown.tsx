'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, PieChart, Users, Target } from 'lucide-react';
import {
    getCommissionsByRole,
    getCommissionsByLeadSource,
    RoleBreakdown,
    LeadSourceBreakdown
} from '@/lib/actions/commission-analytics';
import { formatCurrency, cn } from '@/lib/utils';

type BreakdownType = 'role' | 'leadSource';

interface Props {
    type?: BreakdownType;
}

const ROLE_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
    coach: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', bar: 'bg-emerald-500' },
    closer: { bg: 'bg-blue-500/20', text: 'text-blue-400', bar: 'bg-blue-500' },
    setter: { bg: 'bg-purple-500/20', text: 'text-purple-400', bar: 'bg-purple-500' },
    referrer: { bg: 'bg-orange-500/20', text: 'text-orange-400', bar: 'bg-orange-500' },
};

const SOURCE_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
    company_driven: { bg: 'bg-blue-500/20', text: 'text-blue-400', bar: 'bg-blue-500' },
    coach_driven: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', bar: 'bg-emerald-500' },
    unknown: { bg: 'bg-gray-500/20', text: 'text-gray-400', bar: 'bg-gray-500' },
};

export function CommissionBreakdown({ type = 'role' }: Props) {
    const [breakdownType, setBreakdownType] = useState<BreakdownType>(type);
    const [roleData, setRoleData] = useState<RoleBreakdown[]>([]);
    const [sourceData, setSourceData] = useState<LeadSourceBreakdown[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchData() {
            setLoading(true);
            try {
                const [roles, sources] = await Promise.all([
                    getCommissionsByRole(),
                    getCommissionsByLeadSource()
                ]);
                setRoleData(roles);
                setSourceData(sources);
            } catch (e) {
                console.error('Error fetching breakdown:', e);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, []);

    const data = breakdownType === 'role' ? roleData : sourceData;
    const total = data.reduce((sum, d) => sum + d.totalAmount, 0);

    const getColors = (key: string) => {
        if (breakdownType === 'role') {
            return ROLE_COLORS[key] || ROLE_COLORS.coach;
        }
        return SOURCE_COLORS[key] || SOURCE_COLORS.unknown;
    };

    const formatLabel = (label: string) => {
        if (breakdownType === 'leadSource') {
            return label === 'company_driven' ? 'Company Driven' :
                   label === 'coach_driven' ? 'Coach Driven' :
                   label.charAt(0).toUpperCase() + label.slice(1);
        }
        return label.charAt(0).toUpperCase() + label.slice(1);
    };

    return (
        <Card className="bg-card/40 border-white/5 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                    <PieChart className="h-5 w-5 text-emerald-500" />
                    Commission Breakdown
                </CardTitle>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setBreakdownType('role')}
                        className={cn(
                            "flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors",
                            breakdownType === 'role'
                                ? "bg-emerald-500/20 text-emerald-400"
                                : "text-muted-foreground hover:text-white"
                        )}
                    >
                        <Users className="h-3 w-3" />
                        By Role
                    </button>
                    <button
                        onClick={() => setBreakdownType('leadSource')}
                        className={cn(
                            "flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors",
                            breakdownType === 'leadSource'
                                ? "bg-blue-500/20 text-blue-400"
                                : "text-muted-foreground hover:text-white"
                        )}
                    >
                        <Target className="h-3 w-3" />
                        By Source
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
                        {/* Donut-style visualization */}
                        <div className="flex items-center justify-center">
                            <div className="relative w-40 h-40">
                                {/* Background circle */}
                                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                                    <circle
                                        cx="50"
                                        cy="50"
                                        r="40"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="12"
                                        className="text-white/10"
                                    />
                                    {/* Segments */}
                                    {data.reduce((acc, item, index) => {
                                        const key = breakdownType === 'role' ? (item as RoleBreakdown).role : (item as LeadSourceBreakdown).leadSource;
                                        const colors = getColors(key);
                                        const circumference = 2 * Math.PI * 40;
                                        const strokeDasharray = (item.percentage / 100) * circumference;
                                        const strokeDashoffset = -acc.offset;

                                        acc.elements.push(
                                            <circle
                                                key={index}
                                                cx="50"
                                                cy="50"
                                                r="40"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="12"
                                                strokeDasharray={`${strokeDasharray} ${circumference}`}
                                                strokeDashoffset={strokeDashoffset}
                                                className={colors.text}
                                            />
                                        );
                                        acc.offset += strokeDasharray;
                                        return acc;
                                    }, { elements: [] as React.ReactElement[], offset: 0 }).elements}
                                </svg>
                                {/* Center text */}
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-xl font-bold text-white">
                                        {formatCurrency(total)}
                                    </span>
                                    <span className="text-xs text-muted-foreground">Total</span>
                                </div>
                            </div>
                        </div>

                        {/* Legend with bars */}
                        <div className="space-y-3">
                            {data.map((item, index) => {
                                const key = breakdownType === 'role' ? (item as RoleBreakdown).role : (item as LeadSourceBreakdown).leadSource;
                                const colors = getColors(key);

                                return (
                                    <div key={index} className="space-y-1">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className={cn("w-3 h-3 rounded-full", colors.bar)} />
                                                <span className="text-sm">{formatLabel(key)}</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-sm text-muted-foreground">
                                                    {item.count} deals
                                                </span>
                                                <span className={cn("font-medium", colors.text)}>
                                                    {formatCurrency(item.totalAmount)}
                                                </span>
                                            </div>
                                        </div>
                                        {/* Progress bar */}
                                        <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                                            <div
                                                className={cn("h-full rounded-full transition-all duration-500", colors.bar)}
                                                style={{ width: `${item.percentage}%` }}
                                            />
                                        </div>
                                        <div className="text-xs text-muted-foreground text-right">
                                            {item.percentage.toFixed(1)}%
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
