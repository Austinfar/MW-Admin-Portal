'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Trophy, Medal, Award, TrendingUp } from 'lucide-react';
import { getTopEarners, CoachEarnings } from '@/lib/actions/commission-analytics';
import { formatCurrency, cn } from '@/lib/utils';

interface Props {
    initialPeriod?: 'month' | 'quarter' | 'year' | 'all';
}

const PERIOD_OPTIONS = [
    { value: 'month', label: 'This Month' },
    { value: 'quarter', label: 'This Quarter' },
    { value: 'year', label: 'This Year' },
    { value: 'all', label: 'All Time' },
] as const;

const ROLE_COLORS: Record<string, string> = {
    coach: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    closer: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    setter: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    referrer: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
};

export function CommissionLeaderboard({ initialPeriod = 'month' }: Props) {
    const [period, setPeriod] = useState<'month' | 'quarter' | 'year' | 'all'>(initialPeriod);
    const [data, setData] = useState<CoachEarnings[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchData() {
            setLoading(true);
            try {
                const result = await getTopEarners(10, period);
                setData(result);
            } catch (e) {
                console.error('Error fetching leaderboard:', e);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [period]);

    const getRankIcon = (index: number) => {
        switch (index) {
            case 0:
                return <Trophy className="h-5 w-5 text-yellow-500" />;
            case 1:
                return <Medal className="h-5 w-5 text-gray-400" />;
            case 2:
                return <Award className="h-5 w-5 text-amber-600" />;
            default:
                return <span className="w-5 h-5 flex items-center justify-center text-sm text-muted-foreground">{index + 1}</span>;
        }
    };

    const maxEarnings = data.length > 0 ? data[0].totalEarnings : 0;

    return (
        <Card className="bg-card/40 border-white/5 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-emerald-500" />
                    Top Earners
                </CardTitle>
                <select
                    value={period}
                    onChange={(e) => setPeriod(e.target.value as typeof period)}
                    className="h-8 px-2 py-1 bg-[#1a1a1a] border border-white/10 rounded-md text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                >
                    {PERIOD_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : data.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        No commission data for this period
                    </div>
                ) : (
                    <div className="space-y-3">
                        {data.map((coach, index) => (
                            <div
                                key={coach.coachId}
                                className={cn(
                                    "flex items-center gap-3 p-3 rounded-lg transition-colors",
                                    index === 0 && "bg-yellow-500/10 border border-yellow-500/20",
                                    index === 1 && "bg-gray-500/10 border border-gray-500/20",
                                    index === 2 && "bg-amber-500/10 border border-amber-500/20",
                                    index > 2 && "bg-white/5 hover:bg-white/10"
                                )}
                            >
                                <div className="flex-shrink-0">
                                    {getRankIcon(index)}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium truncate">{coach.coachName}</span>
                                        <Badge
                                            variant="outline"
                                            className={cn("text-xs capitalize", ROLE_COLORS[coach.role] || ROLE_COLORS.coach)}
                                        >
                                            {coach.role}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center gap-4 mt-1">
                                        <span className="text-xs text-muted-foreground">
                                            {coach.dealsClosed} deals
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            Avg: {formatCurrency(coach.averageCommission)}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex flex-col items-end">
                                    <span className={cn(
                                        "font-bold",
                                        index === 0 ? "text-yellow-500 text-lg" :
                                        index === 1 ? "text-gray-400" :
                                        index === 2 ? "text-amber-600" :
                                        "text-emerald-500"
                                    )}>
                                        {formatCurrency(coach.totalEarnings)}
                                    </span>
                                    {/* Progress bar showing relative earnings */}
                                    <div className="w-20 h-1.5 bg-white/10 rounded-full mt-1 overflow-hidden">
                                        <div
                                            className={cn(
                                                "h-full rounded-full transition-all",
                                                index === 0 ? "bg-yellow-500" :
                                                index === 1 ? "bg-gray-400" :
                                                index === 2 ? "bg-amber-600" :
                                                "bg-emerald-500"
                                            )}
                                            style={{
                                                width: `${maxEarnings > 0 ? (coach.totalEarnings / maxEarnings) * 100 : 0}%`
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
