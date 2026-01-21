'use client'

import { useState } from 'react'
import { LeaderboardItem } from '@/lib/actions/sales-dashboard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Trophy, TrendingUp, TrendingDown, Minus, Target } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CloserLeaderboardItem, SetterLeaderboardItem, LeaderboardPeriod, SalesFloorViewMode } from '@/types/sales-floor'

// Legacy interface for backward compatibility
interface LeaderboardProps {
    data: LeaderboardItem[]
}

// Enhanced interface for new Sales Floor
interface EnhancedLeaderboardProps {
    mode: SalesFloorViewMode
    closerData?: CloserLeaderboardItem[]
    setterData?: SetterLeaderboardItem[]
    defaultPeriod?: LeaderboardPeriod
    onPeriodChange?: (period: LeaderboardPeriod) => void
}

function PeriodToggle({
    period,
    onChange,
}: {
    period: LeaderboardPeriod
    onChange: (period: LeaderboardPeriod) => void
}) {
    return (
        <div className="flex items-center gap-1 p-0.5 bg-gray-800/50 rounded-md">
            {(['today', 'week', 'month'] as LeaderboardPeriod[]).map(p => (
                <button
                    key={p}
                    onClick={() => onChange(p)}
                    className={cn(
                        'px-2 py-1 text-xs rounded transition-colors capitalize',
                        period === p
                            ? 'bg-gray-700 text-white'
                            : 'text-gray-500 hover:text-gray-300'
                    )}
                >
                    {p}
                </button>
            ))}
        </div>
    )
}

function TrendIndicator({ trend }: { trend: 'up' | 'down' | 'same' }) {
    if (trend === 'up') {
        return <TrendingUp className="w-3 h-3 text-emerald-400" />
    }
    if (trend === 'down') {
        return <TrendingDown className="w-3 h-3 text-red-400" />
    }
    return <Minus className="w-3 h-3 text-gray-500" />
}

function RankBadge({ rank, isCurrentUser }: { rank: number; isCurrentUser?: boolean }) {
    return (
        <div className={cn(
            "flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm relative",
            rank === 1 ? "bg-yellow-500/20 text-yellow-500 border border-yellow-500/50" :
                rank === 2 ? "bg-gray-400/20 text-gray-400 border border-gray-400/50" :
                    rank === 3 ? "bg-amber-700/20 text-amber-700 border border-amber-700/50" :
                        "bg-gray-800 text-gray-500",
            isCurrentUser && "ring-2 ring-emerald-500 ring-offset-2 ring-offset-[#1A1A1A]"
        )}>
            {rank}
        </div>
    )
}

// Enhanced Leaderboard for Sales Floor
export function EnhancedLeaderboard({
    mode,
    closerData = [],
    setterData = [],
    defaultPeriod = 'month',
    onPeriodChange,
}: EnhancedLeaderboardProps) {
    const [period, setPeriod] = useState<LeaderboardPeriod>(defaultPeriod)

    const handlePeriodChange = (newPeriod: LeaderboardPeriod) => {
        setPeriod(newPeriod)
        onPeriodChange?.(newPeriod)
    }

    const isCloserMode = mode === 'closer'
    const data = isCloserMode ? closerData : setterData
    const title = isCloserMode ? 'Revenue Leaderboard' : 'Booking Leaderboard'

    return (
        <Card className="bg-[#1A1A1A] border-gray-800">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-medium text-white flex items-center">
                        {isCloserMode ? (
                            <Trophy className="w-4 h-4 mr-2 text-yellow-500" />
                        ) : (
                            <Target className="w-4 h-4 mr-2 text-blue-500" />
                        )}
                        {title}
                    </CardTitle>
                    <PeriodToggle period={period} onChange={handlePeriodChange} />
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {data.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                            No data yet this {period}.
                        </p>
                    )}
                    {isCloserMode && (closerData as CloserLeaderboardItem[]).map((item) => (
                        <div
                            key={item.id}
                            className={cn(
                                "flex items-center justify-between p-2 rounded-lg transition-colors",
                                item.isCurrentUser
                                    ? "bg-emerald-500/10 border border-emerald-500/20"
                                    : "hover:bg-white/5"
                            )}
                        >
                            <div className="flex items-center space-x-3">
                                <RankBadge rank={item.rank} isCurrentUser={item.isCurrentUser} />
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-medium text-white">{item.name}</p>
                                        {item.isCurrentUser && (
                                            <Badge variant="outline" className="text-xs bg-emerald-500/20 text-emerald-400 border-emerald-500/50">
                                                You
                                            </Badge>
                                        )}
                                    </div>
                                    <div className="flex items-center text-xs text-gray-500 space-x-2">
                                        <span>{item.deals} deals</span>
                                        {item.closeRate > 0 && (
                                            <span>• {item.closeRate}% close rate</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <TrendIndicator trend={item.trend} />
                                <p className="text-sm font-bold text-emerald-400">
                                    ${item.revenue.toLocaleString()}
                                </p>
                            </div>
                        </div>
                    ))}
                    {!isCloserMode && (setterData as SetterLeaderboardItem[]).map((item) => (
                        <div
                            key={item.id}
                            className={cn(
                                "flex items-center justify-between p-2 rounded-lg transition-colors",
                                item.isCurrentUser
                                    ? "bg-blue-500/10 border border-blue-500/20"
                                    : "hover:bg-white/5"
                            )}
                        >
                            <div className="flex items-center space-x-3">
                                <RankBadge rank={item.rank} isCurrentUser={item.isCurrentUser} />
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-medium text-white">{item.name}</p>
                                        {item.isCurrentUser && (
                                            <Badge variant="outline" className="text-xs bg-blue-500/20 text-blue-400 border-blue-500/50">
                                                You
                                            </Badge>
                                        )}
                                    </div>
                                    <div className="flex items-center text-xs text-gray-500 space-x-2">
                                        <span>{item.shows} shows</span>
                                        <span>• {item.showRate}% show rate</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <TrendIndicator trend={item.trend} />
                                <p className="text-sm font-bold text-blue-400">
                                    {item.bookings} bookings
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}

// Legacy Leaderboard for backward compatibility
export function Leaderboard({ data }: LeaderboardProps) {
    return (
        <Card className="bg-[#1A1A1A] border-gray-800">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg font-medium text-white flex items-center">
                    <Trophy className="w-4 h-4 mr-2 text-yellow-500" />
                    Revenue Leaderboard
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {data.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">No sales data yet this month.</p>
                    )}
                    {data.map((item, index) => (
                        <div key={item.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition-colors">
                            <div className="flex items-center space-x-3">
                                <div className={cn(
                                    "flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm",
                                    index === 0 ? "bg-yellow-500/20 text-yellow-500 border border-yellow-500/50" :
                                        index === 1 ? "bg-gray-400/20 text-gray-400 border border-gray-400/50" :
                                            index === 2 ? "bg-amber-700/20 text-amber-700 border border-amber-700/50" :
                                                "bg-gray-800 text-gray-500"
                                )}>
                                    {index + 1}
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-white">{item.name}</p>
                                    <div className="flex items-center text-xs text-gray-500 space-x-2">
                                        <span className="flex items-center">
                                            <TrendingUp className="w-3 h-3 mr-1" /> {item.deals} Deals
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-bold text-emerald-400">
                                    ${item.revenue.toLocaleString()}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}
