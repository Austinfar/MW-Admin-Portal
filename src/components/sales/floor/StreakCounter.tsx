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
        <Card className="bg-zinc-900/40 backdrop-blur-xl border-orange-500/20 h-full shadow-[0_0_30px_-10px_rgba(249,115,22,0.1)] hover:shadow-[0_0_40px_-5px_rgba(249,115,22,0.2)] transition-shadow duration-500">
            <CardContent className="flex flex-col items-center justify-center py-4 h-full relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent pointer-events-none" />
                <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-full mb-2 animate-pulse shadow-[0_0_15px_rgba(249,115,22,0.3)]">
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
