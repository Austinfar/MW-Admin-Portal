'use client'

import React from 'react'
import { TickerItem } from '@/lib/actions/sales-dashboard'
import { DollarSign, CalendarCheck } from 'lucide-react'

interface LiveTickerProps {
    items: TickerItem[]
}

export function LiveTicker({ items }: LiveTickerProps) {
    if (!items.length) return null

    return (
        <div className="w-full bg-emerald-950/30 border-y border-emerald-900/50 backdrop-blur-sm h-10 flex items-center overflow-hidden relative">
            <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-[#09090b] to-transparent z-10" />
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#09090b] to-transparent z-10" />

            <div className="animate-marquee whitespace-nowrap flex items-center gap-8 px-4">
                {/* Double the items to create seamless loop illusion if few items */}
                {[...items, ...items].map((item, i) => (
                    <div key={`${item.id}-${i}`} className="inline-flex items-center space-x-2 text-sm font-medium">
                        {item.type === 'sale' ? (
                            <span className="flex items-center text-emerald-400">
                                <DollarSign className="w-3.5 h-3.5 mr-1" />
                                {item.message}
                            </span>
                        ) : (
                            <span className="flex items-center text-sky-400">
                                <CalendarCheck className="w-3.5 h-3.5 mr-1" />
                                {item.message}
                            </span>
                        )}
                        <span className="text-gray-600 text-xs mx-2">•</span>
                    </div>
                ))}
            </div>
        </div>
    )
}
