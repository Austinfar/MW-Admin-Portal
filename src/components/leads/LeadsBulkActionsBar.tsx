'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { X, ChevronDown, UserCog, Download, RefreshCw, Trash2, Star } from 'lucide-react'
import { EnhancedLead, LeadStatus } from '@/types/lead'
import {
    bulkUpdateLeadStatus,
    bulkAssignUser,
    bulkDeleteLeads,
    bulkTogglePriority
} from '@/lib/actions/lead-actions'
import { toast } from 'sonner'

interface LeadsBulkActionsBarProps {
    selectedIds: Set<string>
    selectedLeads: EnhancedLead[]
    users: { id: string; name: string; role: string }[]
    onClear: () => void
    onExport: () => void
}

const LEAD_STATUSES: { value: LeadStatus; label: string }[] = [
    { value: 'New', label: 'New' },
    { value: 'Contacted', label: 'Contacted' },
    { value: 'Appt Set', label: 'Appt Set' },
    { value: 'Call Confirmed', label: 'Call Confirmed' },
    { value: 'Closed Won', label: 'Closed Won' },
    { value: 'Closed Lost', label: 'Closed Lost' },
    { value: 'No Show', label: 'No Show' },
]

export function LeadsBulkActionsBar({
    selectedIds,
    selectedLeads,
    users,
    onClear,
    onExport
}: LeadsBulkActionsBarProps) {
    const [isPending, startTransition] = useTransition()

    const setters = users.filter(u => ['setter', 'admin', 'owner'].includes(u.role))
    const closers = users.filter(u => ['closer', 'admin', 'owner'].includes(u.role))

    const handleStatusChange = (status: LeadStatus) => {
        startTransition(async () => {
            const result = await bulkUpdateLeadStatus(Array.from(selectedIds), status)
            if (result.error) {
                toast.error('Failed to update status', { description: result.error })
            } else {
                toast.success(`Updated ${result.updated} leads to ${status}`)
                onClear()
            }
        })
    }

    const handleSetterAssign = (userId: string | null) => {
        startTransition(async () => {
            const result = await bulkAssignUser(Array.from(selectedIds), userId, 'setter')
            if (result.error) {
                toast.error('Failed to assign setter', { description: result.error })
            } else {
                const userName = userId ? users.find(u => u.id === userId)?.name : 'Unassigned'
                toast.success(`Assigned ${result.updated} leads to ${userName}`)
                onClear()
            }
        })
    }

    const handleCloserAssign = (userId: string | null) => {
        startTransition(async () => {
            const result = await bulkAssignUser(Array.from(selectedIds), userId, 'closer')
            if (result.error) {
                toast.error('Failed to assign closer', { description: result.error })
            } else {
                const userName = userId ? users.find(u => u.id === userId)?.name : 'Unassigned'
                toast.success(`Assigned ${result.updated} leads to ${userName}`)
                onClear()
            }
        })
    }

    const handleTogglePriority = () => {
        const allPriority = selectedLeads.every(l => l.is_priority)
        const newPriority = !allPriority

        startTransition(async () => {
            const result = await bulkTogglePriority(Array.from(selectedIds), newPriority)
            if (result.error) {
                toast.error('Failed to update priority', { description: result.error })
            } else {
                toast.success(`${newPriority ? 'Marked' : 'Unmarked'} ${result.updated} leads as priority`)
                onClear()
            }
        })
    }

    const handleBulkDelete = () => {
        if (!confirm(`Are you sure you want to delete ${selectedIds.size} leads? This cannot be undone.`)) {
            return
        }

        startTransition(async () => {
            const result = await bulkDeleteLeads(Array.from(selectedIds))
            if (result.error) {
                toast.error('Failed to delete leads', { description: result.error })
            } else {
                toast.success(`Deleted ${result.deleted} leads`)
                onClear()
            }
        })
    }

    if (selectedIds.size === 0) return null

    const allPriority = selectedLeads.every(l => l.is_priority)

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
            <div className="flex items-center gap-3 bg-card border border-primary/20 rounded-lg px-4 py-3 shadow-lg">
                <span className="text-sm font-medium text-muted-foreground">
                    {selectedIds.size} selected
                </span>

                <div className="h-4 w-px bg-border" />

                {/* Priority Toggle */}
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleTogglePriority}
                    disabled={isPending}
                    className={allPriority ? "border-yellow-500/50 text-yellow-500" : ""}
                >
                    <Star className={`h-4 w-4 mr-2 ${allPriority ? 'fill-yellow-500' : ''}`} />
                    {allPriority ? 'Unmark Priority' : 'Mark Priority'}
                </Button>

                {/* Status Change */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" disabled={isPending}>
                            {isPending ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : null}
                            Status
                            <ChevronDown className="h-4 w-4 ml-1" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        {LEAD_STATUSES.map(status => (
                            <DropdownMenuItem
                                key={status.value}
                                onClick={() => handleStatusChange(status.value)}
                            >
                                {status.label}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>

                {/* Setter Assign */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" disabled={isPending}>
                            <UserCog className="h-4 w-4 mr-2" />
                            Setter
                            <ChevronDown className="h-4 w-4 ml-1" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="max-h-64 overflow-y-auto">
                        <DropdownMenuItem onClick={() => handleSetterAssign(null)}>
                            <span className="text-muted-foreground italic">Unassign</span>
                        </DropdownMenuItem>
                        {setters.map(user => (
                            <DropdownMenuItem
                                key={user.id}
                                onClick={() => handleSetterAssign(user.id)}
                            >
                                {user.name}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>

                {/* Closer Assign */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" disabled={isPending}>
                            <UserCog className="h-4 w-4 mr-2" />
                            Closer
                            <ChevronDown className="h-4 w-4 ml-1" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="max-h-64 overflow-y-auto">
                        <DropdownMenuItem onClick={() => handleCloserAssign(null)}>
                            <span className="text-muted-foreground italic">Unassign</span>
                        </DropdownMenuItem>
                        {closers.map(user => (
                            <DropdownMenuItem
                                key={user.id}
                                onClick={() => handleCloserAssign(user.id)}
                            >
                                {user.name}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>

                {/* Export */}
                <Button variant="outline" size="sm" onClick={onExport} disabled={isPending}>
                    <Download className="h-4 w-4 mr-2" />
                    Export
                </Button>

                {/* Delete */}
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBulkDelete}
                    disabled={isPending}
                    className="text-red-500 hover:text-red-500 hover:bg-red-500/10 border-red-500/30"
                >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
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
