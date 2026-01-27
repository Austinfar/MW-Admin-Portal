'use client'

import { useState } from 'react'
import { LeadsTable } from './LeadsTable'
import { LeadStatsCards } from './LeadStatsCards'
import { LeadPipelineFunnel } from './LeadPipelineFunnel'
import { LeadSourceBreakdown } from './LeadSourceBreakdown'
import { EnhancedLead, LeadStats, LeadFunnelData, LeadSourceData } from '@/types/lead'

interface LeadsPageContentProps {
    leads: EnhancedLead[]
    users: { id: string; name: string; role: string }[]
    currentUserId?: string
    stats: LeadStats
    funnelData: LeadFunnelData
    sourceData: LeadSourceData[]
}

export function LeadsPageContent({
    leads,
    users,
    currentUserId,
    stats,
    funnelData,
    sourceData
}: LeadsPageContentProps) {
    const [filteredStage, setFilteredStage] = useState<string | null>(null)
    const [filteredSource, setFilteredSource] = useState<string | null>(null)

    const handleStageClick = (stage: string | null) => {
        setFilteredStage(stage)
        // Clear source filter when clicking funnel stage
        if (stage) setFilteredSource(null)
    }

    const handleSourceClick = (source: string | null) => {
        setFilteredSource(source)
        // Clear stage filter when clicking source
        if (source) setFilteredStage(null)
    }

    return (
        <div className="space-y-6">
            {/* Stats Cards */}
            <LeadStatsCards stats={stats} />

            {/* Pipeline Funnel & Source Breakdown */}
            <div className="grid gap-6 md:grid-cols-3">
                <div className="md:col-span-2">
                    <LeadPipelineFunnel
                        data={funnelData}
                        onStageClick={handleStageClick}
                        selectedStage={filteredStage}
                        delay={4}
                    />
                </div>
                <div className="md:col-span-1">
                    <LeadSourceBreakdown
                        data={sourceData}
                        onSourceClick={handleSourceClick}
                        selectedSource={filteredSource}
                        delay={5}
                    />
                </div>
            </div>

            {/* Active Filter Indicator */}
            {(filteredStage || filteredSource) && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Filtering by:</span>
                    {filteredStage && (
                        <button
                            onClick={() => setFilteredStage(null)}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-md hover:bg-primary/20 transition-colors"
                        >
                            Stage: {filteredStage}
                            <span className="ml-1">×</span>
                        </button>
                    )}
                    {filteredSource && (
                        <button
                            onClick={() => setFilteredSource(null)}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-md hover:bg-primary/20 transition-colors"
                        >
                            Source: {filteredSource}
                            <span className="ml-1">×</span>
                        </button>
                    )}
                </div>
            )}

            {/* Leads Table */}
            <LeadsTable
                initialLeads={leads}
                users={users}
                currentUserId={currentUserId}
                filteredStage={filteredStage}
                filteredSource={filteredSource}
            />
        </div>
    )
}
