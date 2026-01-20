'use client'

import { useState, useCallback } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Megaphone, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

import { SubmitRequestForm } from './SubmitRequestForm'
import { RequestList } from './RequestList'
import { KanbanBoard } from './KanbanBoard'
import { TimelineView } from './TimelineView'
import { ChangelogView } from './ChangelogView'
import { AdminPanel } from './AdminPanel'
import { CommandPalette } from './CommandPalette'

import type {
    FeatureRequest,
    FeatureTag,
    Milestone,
    Announcement,
    RoadmapStats,
    RequestListResult,
} from '@/types/roadmap'
import { dismissAnnouncement } from '@/lib/actions/feature-requests'

interface RoadmapPageProps {
    initialStats: RoadmapStats
    initialRequests: RequestListResult
    initialTags: FeatureTag[]
    initialMilestones: Milestone[]
    announcements: Announcement[]
    isSuperAdmin: boolean
    currentUserId?: string
}

export function RoadmapPage({
    initialStats,
    initialRequests,
    initialTags,
    initialMilestones,
    announcements: initialAnnouncements,
    isSuperAdmin,
    currentUserId,
}: RoadmapPageProps) {
    const [stats, setStats] = useState(initialStats)
    const [announcements, setAnnouncements] = useState(initialAnnouncements)
    const [activeTab, setActiveTab] = useState('requests')

    const handleDismissAnnouncement = useCallback(async (id: string) => {
        const result = await dismissAnnouncement(id)
        if (result.success) {
            setAnnouncements(prev => prev.filter(a => a.id !== id))
        }
    }, [])

    const refreshStats = useCallback((newStats: RoadmapStats) => {
        setStats(newStats)
    }, [])

    // Command palette handlers
    const handleNewRequest = useCallback(() => {
        setActiveTab('submit')
    }, [])

    const handleFocusSearch = useCallback(() => {
        setActiveTab('requests')
        // Focus the search input after a short delay
        setTimeout(() => {
            const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement
            searchInput?.focus()
        }, 100)
    }, [])

    const handleNavigateToTab = useCallback((tab: string) => {
        setActiveTab(tab)
    }, [])

    return (
        <div className="space-y-6">
            {/* Command Palette */}
            <CommandPalette
                onNewRequest={handleNewRequest}
                onFocusSearch={handleFocusSearch}
                onNavigateToTab={handleNavigateToTab}
            />

            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Feature Requests & Roadmap</h1>
                    <p className="text-muted-foreground">
                        Submit ideas, vote on features, and track what's being built
                        <span className="ml-2 text-xs text-muted-foreground/60">
                            Press <kbd className="px-1.5 py-0.5 text-[10px] bg-muted rounded border">⌘K</kbd> for quick actions
                        </span>
                    </p>
                </div>
            </div>

            {/* Announcements */}
            {announcements.length > 0 && (
                <div className="space-y-2">
                    {announcements.map(announcement => (
                        <Card key={announcement.id} className="bg-neon-green/5 border-neon-green/20">
                            <CardContent className="py-3 px-4 flex items-start gap-3">
                                <Megaphone className="h-5 w-5 text-neon-green flex-shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-neon-green">{announcement.title}</p>
                                    <p className="text-sm text-muted-foreground">{announcement.content}</p>
                                </div>
                                {isSuperAdmin && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 flex-shrink-0"
                                        onClick={() => handleDismissAnnouncement(announcement.id)}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                <StatsCard label="Total" value={stats.total} />
                <StatsCard label="Submitted" value={stats.submitted} color="zinc" />
                <StatsCard label="Reviewing" value={stats.reviewing} color="blue" />
                <StatsCard label="Planned" value={stats.planned} color="amber" />
                <StatsCard label="In Progress" value={stats.in_progress} color="green" />
                <StatsCard label="Completed" value={stats.completed} color="emerald" />
                <StatsCard label="Rejected" value={stats.rejected} color="red" />
            </div>

            {/* Main Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="bg-muted/50">
                    <TabsTrigger value="submit">Submit Request</TabsTrigger>
                    <TabsTrigger value="requests">
                        All Requests
                        <Badge variant="secondary" className="ml-2 text-xs">
                            {stats.total}
                        </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="my-requests">My Requests</TabsTrigger>
                    <TabsTrigger value="roadmap">Roadmap</TabsTrigger>
                    <TabsTrigger value="timeline">Timeline</TabsTrigger>
                    <TabsTrigger value="changelog">Changelog</TabsTrigger>
                    {isSuperAdmin && (
                        <TabsTrigger value="admin">Admin Panel</TabsTrigger>
                    )}
                </TabsList>

                <TabsContent value="submit" className="mt-6">
                    <SubmitRequestForm
                        onSuccess={() => {
                            setActiveTab('requests')
                        }}
                    />
                </TabsContent>

                <TabsContent value="requests" className="mt-6">
                    <RequestList
                        initialData={initialRequests}
                        tags={initialTags}
                        milestones={initialMilestones}
                        isSuperAdmin={isSuperAdmin}
                        onStatsChange={refreshStats}
                    />
                </TabsContent>

                <TabsContent value="my-requests" className="mt-6">
                    <RequestList
                        initialData={{ ...initialRequests, data: [] }}
                        tags={initialTags}
                        milestones={initialMilestones}
                        isSuperAdmin={isSuperAdmin}
                        onStatsChange={refreshStats}
                        filterByUserId={currentUserId}
                        showMyRequestsHeader
                    />
                </TabsContent>

                <TabsContent value="roadmap" className="mt-6">
                    <KanbanBoard
                        milestones={initialMilestones}
                        isSuperAdmin={isSuperAdmin}
                    />
                </TabsContent>

                <TabsContent value="timeline" className="mt-6">
                    <TimelineView
                        milestones={initialMilestones}
                        isSuperAdmin={isSuperAdmin}
                    />
                </TabsContent>

                <TabsContent value="changelog" className="mt-6">
                    <ChangelogView />
                </TabsContent>

                {isSuperAdmin && (
                    <TabsContent value="admin" className="mt-6">
                        <AdminPanel
                            tags={initialTags}
                            milestones={initialMilestones}
                            stats={stats}
                        />
                    </TabsContent>
                )}
            </Tabs>
        </div>
    )
}

function StatsCard({
    label,
    value,
    color = 'default'
}: {
    label: string
    value: number
    color?: 'default' | 'zinc' | 'blue' | 'amber' | 'green' | 'emerald' | 'red'
}) {
    const colorClasses = {
        default: 'text-foreground',
        zinc: 'text-zinc-400',
        blue: 'text-blue-400',
        amber: 'text-amber-400',
        green: 'text-neon-green',
        emerald: 'text-emerald-400',
        red: 'text-red-400',
    }

    return (
        <Card className="bg-card/50">
            <CardContent className="py-3 px-4 text-center">
                <p className={`text-2xl font-bold ${colorClasses[color]}`}>{value}</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
            </CardContent>
        </Card>
    )
}
