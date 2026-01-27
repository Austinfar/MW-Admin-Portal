'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RenewalStatsCards } from './RenewalStatsCards'
import { RenewalsTable } from './RenewalsTable'
import { RenewalsCalendar } from './RenewalsCalendar'
import { RenewalFilters } from './RenewalFilters'
import type { RenewalCalendarEvent } from '@/types/contract'
import type { Coach } from '@/lib/actions/clients'

interface RenewalsDashboardProps {
    clients: RenewalCalendarEvent[]
    stats: {
        totalExpiring30Days: number
        critical: number
        urgent: number
        upcoming: number
        renewed: number
        churned: number
    }
    coaches: Coach[]
    isAdmin: boolean
    currentUserId?: string
}

export function RenewalsDashboard({
    clients,
    stats,
    coaches,
    isAdmin,
    currentUserId,
}: RenewalsDashboardProps) {
    const [filteredClients, setFilteredClients] = useState(clients)
    const [activeView, setActiveView] = useState<'table' | 'calendar'>('table')

    const handleFilterChange = (filters: {
        coachId?: string
        status?: string
        urgency?: string
    }) => {
        let result = [...clients]

        if (filters.coachId && filters.coachId !== 'all') {
            result = result.filter(c => c.coachId === filters.coachId)
        }

        if (filters.status && filters.status !== 'all') {
            result = result.filter(c => c.renewalStatus === filters.status)
        }

        if (filters.urgency && filters.urgency !== 'all') {
            switch (filters.urgency) {
                case 'critical':
                    result = result.filter(c => c.daysUntilExpiration <= 7)
                    break
                case 'urgent':
                    result = result.filter(c => c.daysUntilExpiration > 7 && c.daysUntilExpiration <= 14)
                    break
                case 'upcoming':
                    result = result.filter(c => c.daysUntilExpiration > 14 && c.daysUntilExpiration <= 30)
                    break
                case 'expired':
                    result = result.filter(c => c.daysUntilExpiration < 0)
                    break
            }
        }

        setFilteredClients(result)
    }

    return (
        <div className="space-y-6">
            {/* Stats Cards */}
            <RenewalStatsCards stats={stats} />

            {/* Filters */}
            <RenewalFilters
                coaches={coaches}
                isAdmin={isAdmin}
                onFilterChange={handleFilterChange}
            />

            {/* View Toggle */}
            <Tabs value={activeView} onValueChange={(v) => setActiveView(v as 'table' | 'calendar')}>
                <TabsList>
                    <TabsTrigger value="table">List View</TabsTrigger>
                    <TabsTrigger value="calendar">Calendar View</TabsTrigger>
                </TabsList>

                <TabsContent value="table" className="mt-4">
                    <RenewalsTable clients={filteredClients} />
                </TabsContent>

                <TabsContent value="calendar" className="mt-4">
                    <RenewalsCalendar clients={filteredClients} />
                </TabsContent>
            </Tabs>
        </div>
    )
}
