'use client'

import { FunnelData } from '@/lib/actions/sales-dashboard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Filter } from 'lucide-react'

interface PipelineFunnelProps {
    data: FunnelData
}

export function PipelineFunnel({ data }: PipelineFunnelProps) {
    const showRate = data.booked > 0 ? Math.round((data.showed / data.booked) * 100) : 0
    const closeRate = data.showed > 0 ? Math.round((data.closed / data.showed) * 100) : 0

    return (
        <Card className="bg-zinc-900/40 backdrop-blur-xl border-white/5 h-full shadow-2xl">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-400 flex items-center">
                    <Filter className="w-4 h-4 mr-2" />
                    Month Conversion
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
                {/* Booked Stage */}
                <div className="relative">
                    <div className="flex justify-between text-sm mb-1">
                        <span className="text-white font-medium">Booked</span>
                        <span className="text-white font-bold">{data.booked}</span>
                    </div>
                    <div className="w-full bg-black/40 border border-white/5 rounded-full h-2">
                        <div className="bg-blue-500 h-2 rounded-full w-full opacity-80 shadow-[0_0_10px_rgba(59,130,246,0.4)]" />
                    </div>
                </div>

                {/* Showed Stage */}
                <div className="relative pl-4">
                    <div className="flex justify-between text-sm mb-1">
                        <span className="text-white font-medium">Showed</span>
                        <span className="text-white font-bold">{data.showed}</span>
                    </div>
                    <div className="w-full bg-black/40 border border-white/5 rounded-full h-2">
                        <div
                            className="bg-purple-500 h-2 rounded-full opacity-80 shadow-[0_0_10px_rgba(168,85,247,0.4)]"
                            style={{ width: `${Math.min(100, Math.max(5, showRate))}%` }}
                        />
                    </div>
                    <p className="text-xs text-right text-gray-500 mt-1">{showRate}% Show Rate</p>
                </div>

                {/* Closed Stage */}
                <div className="relative pl-8">
                    <div className="flex justify-between text-sm mb-1">
                        <span className="text-white font-medium">Closed</span>
                        <span className="text-white font-bold">{data.closed}</span>
                    </div>
                    <div className="w-full bg-black/40 border border-white/5 rounded-full h-2">
                        <div
                            className="bg-emerald-500 h-2 rounded-full opacity-80 shadow-[0_0_10px_rgba(16,185,129,0.4)]"
                            style={{ width: `${Math.min(100, Math.max(5, closeRate))}%` }}
                        />
                    </div>
                    <p className="text-xs text-right text-gray-500 mt-1">{closeRate}% Close Rate</p>
                </div>
            </CardContent>
        </Card>
    )
}
