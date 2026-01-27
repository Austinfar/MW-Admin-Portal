'use client'

import { useState } from 'react'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import type { Coach } from '@/lib/actions/clients'

interface RenewalFiltersProps {
    coaches: Coach[]
    isAdmin: boolean
    onFilterChange: (filters: {
        coachId?: string
        status?: string
        urgency?: string
    }) => void
}

export function RenewalFilters({
    coaches,
    isAdmin,
    onFilterChange,
}: RenewalFiltersProps) {
    const [coachId, setCoachId] = useState<string>('all')
    const [status, setStatus] = useState<string>('all')
    const [urgency, setUrgency] = useState<string>('all')

    const handleCoachChange = (value: string) => {
        setCoachId(value)
        onFilterChange({ coachId: value, status, urgency })
    }

    const handleStatusChange = (value: string) => {
        setStatus(value)
        onFilterChange({ coachId, status: value, urgency })
    }

    const handleUrgencyChange = (value: string) => {
        setUrgency(value)
        onFilterChange({ coachId, status, urgency: value })
    }

    return (
        <Card className="p-4 bg-card/50 backdrop-blur-xl border-white/5">
            <div className="flex flex-wrap gap-4">
                {/* Coach Filter - only show for admins */}
                {isAdmin && (
                    <div className="flex flex-col gap-1.5">
                        <Label className="text-xs text-muted-foreground">Coach</Label>
                        <Select value={coachId} onValueChange={handleCoachChange}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="All Coaches" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Coaches</SelectItem>
                                {coaches.map((coach) => (
                                    <SelectItem key={coach.id} value={coach.id}>
                                        {coach.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}

                {/* Status Filter */}
                <div className="flex flex-col gap-1.5">
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <Select value={status} onValueChange={handleStatusChange}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="All Statuses" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Statuses</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="in_discussion">In Discussion</SelectItem>
                            <SelectItem value="renewed">Renewed</SelectItem>
                            <SelectItem value="churned">Churned</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Urgency Filter */}
                <div className="flex flex-col gap-1.5">
                    <Label className="text-xs text-muted-foreground">Urgency</Label>
                    <Select value={urgency} onValueChange={handleUrgencyChange}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="All" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            <SelectItem value="expired">Expired</SelectItem>
                            <SelectItem value="critical">Critical (≤7d)</SelectItem>
                            <SelectItem value="urgent">Urgent (8-14d)</SelectItem>
                            <SelectItem value="upcoming">Upcoming (15-30d)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </Card>
    )
}
