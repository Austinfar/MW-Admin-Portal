'use client'

import React from 'react'
import { TickerItem } from '@/lib/actions/sales-dashboard'
import { DollarSign, CalendarCheck } from 'lucide-react'

interface LiveTickerProps {
    items: TickerItem[]
}

export function LiveTicker({ items }: LiveTickerProps) {
    // If no items, show a placeholder or nothing? User said "contntantly scrolling".
    // If empty, let's show a motivating placeholder
    const displayItems = items.length > 0 ? items : [
        { id: '1', type: 'booking', message: 'Ready to crush it today?', timestamp: new Date().toISOString() },
        { id: '2', type: 'sale', message: 'Let\'s get some sales!', timestamp: new Date().toISOString() }
    ] as TickerItem[];

    return (
        <div className="w-full bg-zinc-900/60 border-y border-white/5 backdrop-blur-md h-10 flex items-center overflow-hidden relative shadow-lg">
            <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

            <div className="flex animate-marquee hover:[animation-play-state:paused] w-max">
                {/* Quadruple the items to ensure seamless loop even on wide screens */}
                {[...displayItems, ...displayItems, ...displayItems, ...displayItems].map((item, i) => (
                    <div key={`${item.id}-${i}`} className="inline-flex items-center mx-6 text-sm font-medium shrink-0">
                        {item.type === 'sale' ? (
                            <span className="flex items-center text-emerald-400">
                                <DollarSign className="w-3.5 h-3.5 mr-1.5" />
                                {item.message}
                            </span>
                        ) : (
                            <span className="flex items-center text-sky-400">
                                <CalendarCheck className="w-3.5 h-3.5 mr-1.5" />
                                {item.message}
                            </span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}
