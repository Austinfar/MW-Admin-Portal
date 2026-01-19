'use client'

import { LeaderboardItem } from '@/lib/actions/sales-dashboard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Trophy, Medal, TrendingUp, Phone } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LeaderboardProps {
    data: LeaderboardItem[]
}

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
                                        {/* Phone Calls placeholder if we had real call data per rep */}
                                        {/* <span className="flex items-center">
                                            <Phone className="w-3 h-3 mr-1" /> {item.calls} Calls
                                        </span> */}
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
