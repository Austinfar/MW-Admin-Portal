'use client'

import { SalesAnalyzer } from '@/components/sales/SalesAnalyzer'

export default function SalesPage() {
    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:space-y-0">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-white mb-2">AI Sales Call Analyzer</h2>
                    <p className="text-muted-foreground">
                        Upload and analyze sales calls with Fireflies.ai.
                    </p>
                </div>
            </div>

            <div className="space-y-4">
                <SalesAnalyzer />
            </div>
        </div>
    )
}
