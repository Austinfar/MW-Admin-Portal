'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { X, ChevronDown, UserCog, Download, RefreshCw } from 'lucide-react'
import { ClientStatus, EnhancedClient } from '@/types/client'
import { bulkUpdateClientStatus, bulkReassignCoach, Coach } from '@/lib/actions/clients'
import { toast } from 'sonner'

interface BulkActionsBarProps {
    selectedIds: Set<string>
    selectedClients: EnhancedClient[]
    coaches: Coach[]
    onClear: () => void
    onExport: () => void
}

const STATUSES: { value: ClientStatus; label: string }[] = [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'lost', label: 'Lost' },
    { value: 'onboarding', label: 'Onboarding' },
]

export function BulkActionsBar({ selectedIds, selectedClients, coaches, onClear, onExport }: BulkActionsBarProps) {
    const [isPending, startTransition] = useTransition()

    const handleStatusChange = (status: ClientStatus) => {
        startTransition(async () => {
            const result = await bulkUpdateClientStatus(Array.from(selectedIds), status)
            if (result.error) {
                toast.error('Failed to update status', { description: result.error })
            } else {
                toast.success(`Updated ${result.updated} clients to ${status}`)
                onClear()
            }
        })
    }

    const handleCoachReassign = (coachId: string | null) => {
        startTransition(async () => {
            const result = await bulkReassignCoach(Array.from(selectedIds), coachId)
            if (result.error) {
                toast.error('Failed to reassign coach', { description: result.error })
            } else {
                const coachName = coachId ? coaches.find(c => c.id === coachId)?.name : 'Unassigned'
                toast.success(`Reassigned ${result.updated} clients to ${coachName}`)
                onClear()
            }
        })
    }

    if (selectedIds.size === 0) return null

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
            <div className="flex items-center gap-3 bg-card border border-primary/20 rounded-lg px-4 py-3 shadow-lg">
                <span className="text-sm font-medium text-muted-foreground">
                    {selectedIds.size} selected
                </span>

                <div className="h-4 w-px bg-border" />

                {/* Status Change */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" disabled={isPending}>
                            {isPending ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : null}
                            Change Status
                            <ChevronDown className="h-4 w-4 ml-1" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        {STATUSES.map(status => (
                            <DropdownMenuItem
                                key={status.value}
                                onClick={() => handleStatusChange(status.value)}
                            >
                                {status.label}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>

                {/* Coach Reassign */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" disabled={isPending}>
                            <UserCog className="h-4 w-4 mr-2" />
                            Reassign Coach
                            <ChevronDown className="h-4 w-4 ml-1" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="max-h-64 overflow-y-auto">
                        <DropdownMenuItem onClick={() => handleCoachReassign(null)}>
                            <span className="text-muted-foreground italic">Unassign</span>
                        </DropdownMenuItem>
                        {coaches.map(coach => (
                            <DropdownMenuItem
                                key={coach.id}
                                onClick={() => handleCoachReassign(coach.id)}
                            >
                                {coach.name}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>

                {/* Export */}
                <Button variant="outline" size="sm" onClick={onExport} disabled={isPending}>
                    <Download className="h-4 w-4 mr-2" />
                    Export
                </Button>

                <div className="h-4 w-px bg-border" />

                {/* Clear */}
                <Button variant="ghost" size="sm" onClick={onClear} disabled={isPending}>
                    <X className="h-4 w-4" />
                </Button>
            </div>
        </div>
    )
}
