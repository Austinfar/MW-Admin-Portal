'use client'

import { StreakItem } from '@/lib/actions/sales-dashboard'
import { Card, CardContent } from '@/components/ui/card'
import { Flame } from 'lucide-react'

interface StreakCounterProps {
    streaks: StreakItem[]
}

export function StreakCounter({ streaks }: StreakCounterProps) {
    // Just find the single best streak for the compact HUD view
    const bestStreak = streaks.reduce((prev, current) => (prev.days > current.days) ? prev : current, { name: 'None', days: 0 })

    return (
        <Card className="bg-gradient-to-br from-orange-900/20 to-[#1A1A1A] border-orange-900/30 h-full">
            <CardContent className="flex flex-col items-center justify-center py-4 h-full">
                <div className="p-3 bg-orange-500/10 rounded-full mb-2 animate-pulse">
                    <Flame className="w-6 h-6 text-orange-500" />
                </div>
                <div className="text-2xl font-bold text-white tabular-nums">
                    {bestStreak.days} Days
                </div>
                <p className="text-xs text-orange-400 font-medium mt-1">
                    Full Team Streak
                </p>
            </CardContent>
        </Card>
    )
}
