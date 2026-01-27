'use client'

import { useState, useMemo, memo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Popover,
    PopoverContent,
    PopoverTrigger
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import {
    MoreHorizontal,
    ArrowRight,
    Trash,
    Star,
    Filter,
    X,
    ArrowUpDown,
    Calendar,
    ExternalLink,
    Copy,
    ListPlus
} from "lucide-react"
import {
    convertLeadToClient,
    deleteLead,
    toggleLeadPriority,
    addToCallQueue
} from "@/lib/actions/lead-actions"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { format, differenceInDays } from 'date-fns'
import { EnhancedLead, LeadFilters, SortField, SortOrder, LeadMetadata } from '@/types/lead'
import { LeadsBulkActionsBar } from './LeadsBulkActionsBar'
import { ScheduleFollowUpDialog } from './ScheduleFollowUpDialog'

interface LeadsTableProps {
    initialLeads: EnhancedLead[]
    users: { id: string; name: string; role: string }[]
    currentUserId?: string
    filteredStage?: string | null
    filteredSource?: string | null
}

const LEAD_STATUSES = [
    { value: 'New', label: 'New', color: 'bg-blue-500' },
    { value: 'Contacted', label: 'Contacted', color: 'bg-yellow-500' },
    { value: 'Appt Set', label: 'Appt Set', color: 'bg-purple-500' },
    { value: 'Closed Won', label: 'Won', color: 'bg-neon-green' },
    { value: 'Closed Lost', label: 'Lost', color: 'bg-red-500' },
    { value: 'No Show', label: 'No Show', color: 'bg-orange-500' },
]

// Helper functions moved outside component to prevent recreation on each render
const STATUS_COLORS: Record<string, string> = {
    'New': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    'Contacted': 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    'Appt Set': 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    'Closed Won': 'bg-neon-green/10 text-neon-green border-neon-green/20',
    'Closed Lost': 'bg-red-500/10 text-red-500 border-red-500/20',
    'No Show': 'bg-orange-500/10 text-orange-500 border-orange-500/20',
}

function getStatusColor(status: string): string {
    return STATUS_COLORS[status] || STATUS_COLORS['New']
}

function getJourneySteps(lead: EnhancedLead) {
    const meta = lead.metadata as LeadMetadata | null
    return [
        { label: 'Contact', done: true },
        { label: 'Coach', done: !!(meta?.coach_selected || meta?.coach_selected_id) },
        { label: 'Booked', done: !!(meta?.consultation_scheduled_for || lead.status === 'Appt Set') },
        { label: 'Quest.', done: !!(meta?.questionnaire_completed_at || meta?.questionnaire) },
    ]
}

function getAgeDisplay(createdAt: string) {
    const days = differenceInDays(new Date(), new Date(createdAt))
    if (days <= 7) return { text: `${days}d`, color: 'text-blue-500' }
    if (days <= 14) return { text: `${days}d`, color: 'text-foreground' }
    if (days <= 30) return { text: `${days}d`, color: 'text-amber-500' }
    return { text: `${days}d`, color: 'text-red-500' }
}

function getAppointmentDisplay(lead: EnhancedLead) {
    const meta = lead.metadata as LeadMetadata | null
    if (!meta?.consultation_scheduled_for) {
        return { text: 'Not Booked', color: 'text-muted-foreground italic' }
    }
    const apptDate = new Date(meta.consultation_scheduled_for)
    const isPast = apptDate < new Date()
    return {
        text: format(apptDate, 'MMM d, h:mm a'),
        color: isPast ? 'text-muted-foreground' : 'text-green-500'
    }
}

export function LeadsTable({
    initialLeads,
    users,
    currentUserId,
    filteredStage,
    filteredSource
}: LeadsTableProps) {
    const router = useRouter()
    const [searchTerm, setSearchTerm] = useState('')
    const [sortField, setSortField] = useState<SortField>('created_at')
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
    const [filters, setFilters] = useState<LeadFilters>({
        statuses: [],
        sources: [],
        assignedUsers: [],
        bookedByUsers: [],
        hasAppointment: 'all',
        priorityOnly: false,
        onlyMyLeads: false
    })
    const [isFilterOpen, setIsFilterOpen] = useState(false)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [followUpDialogOpen, setFollowUpDialogOpen] = useState(false)
    const [followUpLead, setFollowUpLead] = useState<{ id: string; name: string } | null>(null)

    // Get unique sources for filter
    const uniqueSources = useMemo(() => {
        const sources = new Set(initialLeads.map(l => l.source || 'Unknown'))
        return Array.from(sources).sort()
    }, [initialLeads])

    // Count active filters
    const activeFilterCount = useMemo(() => {
        return (
            filters.statuses.length +
            filters.sources.length +
            filters.assignedUsers.length +
            filters.bookedByUsers.length +
            (filters.hasAppointment !== 'all' ? 1 : 0) +
            (filters.priorityOnly ? 1 : 0) +
            (filters.onlyMyLeads ? 1 : 0)
        )
    }, [filters])

    // Filter and sort data
    const filteredData = useMemo(() => {
        return initialLeads.filter((lead) => {
            // Hide converted leads
            if (lead.status === 'converted') return false

            // Search filter
            const searchLower = searchTerm.toLowerCase()
            const matchesSearch = searchTerm === '' ||
                lead.first_name.toLowerCase().includes(searchLower) ||
                lead.last_name?.toLowerCase().includes(searchLower) ||
                lead.email?.toLowerCase().includes(searchLower) ||
                lead.phone?.includes(searchTerm)

            // Status filter
            const matchesStatus = filters.statuses.length === 0 ||
                filters.statuses.includes(lead.status)

            // Source filter
            const matchesSource = filters.sources.length === 0 ||
                filters.sources.includes(lead.source || 'Unknown')

            // Assigned user (closer) filter
            const matchesAssigned = filters.assignedUsers.length === 0 ||
                (lead.assigned_user_id && filters.assignedUsers.includes(lead.assigned_user_id)) ||
                (filters.assignedUsers.includes('unassigned') && !lead.assigned_user_id)

            // Booked by user (setter) filter
            const matchesBookedBy = filters.bookedByUsers.length === 0 ||
                (lead.booked_by_user_id && filters.bookedByUsers.includes(lead.booked_by_user_id)) ||
                (filters.bookedByUsers.includes('unassigned') && !lead.booked_by_user_id)

            // Appointment filter
            const meta = lead.metadata as LeadMetadata | null
            const hasAppt = !!(meta?.consultation_scheduled_for || lead.status === 'Appt Set')
            const matchesAppointment = filters.hasAppointment === 'all' ||
                (filters.hasAppointment === 'booked' && hasAppt) ||
                (filters.hasAppointment === 'not_booked' && !hasAppt)

            // Priority filter
            const matchesPriority = !filters.priorityOnly || lead.is_priority

            // My leads filter
            const matchesMyLeads = !filters.onlyMyLeads ||
                (currentUserId && (lead.assigned_user_id === currentUserId || lead.booked_by_user_id === currentUserId))

            // Funnel stage filter (from clicking pipeline)
            let matchesFunnelStage = true
            if (filteredStage) {
                switch (filteredStage) {
                    case 'contacts':
                        matchesFunnelStage = true
                        break
                    case 'coach':
                        matchesFunnelStage = !!(meta?.coach_selected || meta?.coach_selected_id)
                        break
                    case 'booked':
                        matchesFunnelStage = hasAppt
                        break
                    case 'questionnaire':
                        matchesFunnelStage = !!(meta?.questionnaire_completed_at || meta?.questionnaire)
                        break
                    case 'won':
                        matchesFunnelStage = lead.status === 'Closed Won'
                        break
                }
            }

            // Source filter (from clicking source breakdown)
            const matchesSourceFilter = !filteredSource || (lead.source || 'Unknown') === filteredSource

            return matchesSearch && matchesStatus && matchesSource && matchesAssigned &&
                matchesBookedBy && matchesAppointment && matchesPriority && matchesMyLeads &&
                matchesFunnelStage && matchesSourceFilter
        }).sort((a, b) => {
            let compareA: string | number | boolean = ''
            let compareB: string | number | boolean = ''

            const metaA = a.metadata as LeadMetadata | null
            const metaB = b.metadata as LeadMetadata | null

            switch (sortField) {
                case 'priority':
                    compareA = a.is_priority ? 1 : 0
                    compareB = b.is_priority ? 1 : 0
                    break
                case 'name':
                    compareA = `${a.first_name} ${a.last_name || ''}`.toLowerCase()
                    compareB = `${b.first_name} ${b.last_name || ''}`.toLowerCase()
                    break
                case 'status':
                    compareA = a.status
                    compareB = b.status
                    break
                case 'source':
                    compareA = a.source || ''
                    compareB = b.source || ''
                    break
                case 'setter':
                    compareA = a.booked_by_user?.name || ''
                    compareB = b.booked_by_user?.name || ''
                    break
                case 'closer':
                    compareA = a.assigned_user?.name || ''
                    compareB = b.assigned_user?.name || ''
                    break
                case 'created_at':
                    compareA = new Date(a.created_at).getTime()
                    compareB = new Date(b.created_at).getTime()
                    break
                case 'appointment':
                    compareA = metaA?.consultation_scheduled_for
                        ? new Date(metaA.consultation_scheduled_for).getTime()
                        : 0
                    compareB = metaB?.consultation_scheduled_for
                        ? new Date(metaB.consultation_scheduled_for).getTime()
                        : 0
                    break
            }

            if (compareA < compareB) return sortOrder === 'asc' ? -1 : 1
            if (compareA > compareB) return sortOrder === 'asc' ? 1 : -1
            return 0
        })
    }, [initialLeads, searchTerm, filters, sortField, sortOrder, currentUserId, filteredStage, filteredSource])

    // Handlers
    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
        } else {
            setSortField(field)
            setSortOrder('desc')
        }
    }

    const toggleFilter = (category: 'statuses' | 'sources' | 'assignedUsers' | 'bookedByUsers', value: string) => {
        setFilters(prev => ({
            ...prev,
            [category]: prev[category].includes(value)
                ? prev[category].filter(v => v !== value)
                : [...prev[category], value]
        }))
    }

    const clearFilters = () => {
        setFilters({
            statuses: [],
            sources: [],
            assignedUsers: [],
            bookedByUsers: [],
            hasAppointment: 'all',
            priorityOnly: false,
            onlyMyLeads: false
        })
    }

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) {
                next.delete(id)
            } else {
                next.add(id)
            }
            return next
        })
    }

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredData.length) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(filteredData.map(l => l.id)))
        }
    }

    const clearSelection = () => setSelectedIds(new Set())

    const handlePriorityToggle = async (e: React.MouseEvent, leadId: string) => {
        e.stopPropagation()
        const result = await toggleLeadPriority(leadId)
        if (result.error) {
            toast.error('Failed to update priority')
        }
    }

    const handleConvert = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation()
        toast.promise(async () => {
            const result = await convertLeadToClient(id)
            if (result.error) throw new Error(result.error)
            return result
        }, {
            loading: 'Converting to client...',
            success: 'Lead converted successfully!',
            error: (err) => `Failed to convert: ${err.message || err}`
        })
    }

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation()
        if (!confirm('Are you sure you want to delete this lead?')) return

        const result = await deleteLead(id)
        if (result.error) {
            toast.error(`Failed to delete: ${result.error}`)
        } else {
            toast.success('Lead deleted')
        }
    }

    const handleAddToQueue = async (e: React.MouseEvent, leadId: string) => {
        e.stopPropagation()
        const result = await addToCallQueue(leadId)
        if (result.error) {
            toast.error(result.error)
        } else {
            toast.success('Added to call queue')
        }
    }

    const openFollowUpDialog = (e: React.MouseEvent, lead: EnhancedLead) => {
        e.stopPropagation()
        setFollowUpLead({ id: lead.id, name: `${lead.first_name} ${lead.last_name || ''}` })
        setFollowUpDialogOpen(true)
    }

    // Export to CSV
    const exportToCSV = () => {
        const leadsToExport = selectedIds.size > 0
            ? filteredData.filter(l => selectedIds.has(l.id))
            : filteredData

        const headers = ['Name', 'Email', 'Phone', 'Status', 'Priority', 'Source', 'Setter', 'Closer', 'Created Date', 'Appointment', 'GHL ID']
        const rows = leadsToExport.map(l => {
            const meta = l.metadata as LeadMetadata | null
            return [
                `${l.first_name} ${l.last_name || ''}`,
                l.email || '',
                l.phone || '',
                l.status,
                l.is_priority ? 'Yes' : 'No',
                l.source || '',
                l.booked_by_user?.name || '',
                l.assigned_user?.name || '',
                format(new Date(l.created_at), 'yyyy-MM-dd'),
                meta?.consultation_scheduled_for ? format(new Date(meta.consultation_scheduled_for), 'yyyy-MM-dd HH:mm') : '',
                l.ghl_contact_id || ''
            ]
        })

        const csvContent = [headers, ...rows]
            .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
            .join('\n')

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `leads-export-${format(new Date(), 'yyyy-MM-dd')}.csv`
        link.click()
        URL.revokeObjectURL(url)
    }

    return (
        <div className="space-y-4">
            {/* Search and Filters */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1">
                    <Input
                        placeholder="Search leads..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full md:max-w-sm bg-zinc-900/50 border-zinc-800"
                    />
                    <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="outline" size="icon" className="relative">
                                <Filter className="h-4 w-4" />
                                {activeFilterCount > 0 && (
                                    <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] font-medium text-primary-foreground flex items-center justify-center">
                                        {activeFilterCount}
                                    </span>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80" align="start">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-medium">Filters</h4>
                                    {activeFilterCount > 0 && (
                                        <Button variant="ghost" size="sm" onClick={clearFilters} className="h-auto py-1 px-2 text-xs">
                                            Clear all
                                        </Button>
                                    )}
                                </div>

                                {/* Priority Only */}
                                <div className="flex items-center space-x-2 bg-yellow-500/5 p-2 rounded-md">
                                    <Checkbox
                                        id="priority-only"
                                        checked={filters.priorityOnly}
                                        onCheckedChange={(checked) => setFilters(prev => ({ ...prev, priorityOnly: checked as boolean }))}
                                    />
                                    <label htmlFor="priority-only" className="text-sm font-medium leading-none cursor-pointer flex items-center gap-1">
                                        <Star className="h-3 w-3 text-yellow-500" />
                                        Priority Leads Only
                                    </label>
                                </div>

                                {currentUserId && (
                                    <div className="flex items-center space-x-2 bg-secondary/20 p-2 rounded-md">
                                        <Checkbox
                                            id="my-leads"
                                            checked={filters.onlyMyLeads}
                                            onCheckedChange={(checked) => setFilters(prev => ({ ...prev, onlyMyLeads: checked as boolean }))}
                                        />
                                        <label htmlFor="my-leads" className="text-sm font-medium leading-none cursor-pointer">
                                            My Leads Only
                                        </label>
                                    </div>
                                )}

                                <Separator />

                                {/* Status Filter */}
                                <div className="space-y-2">
                                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</Label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {LEAD_STATUSES.map(status => (
                                            <Button
                                                key={status.value}
                                                variant={filters.statuses.includes(status.value) ? "default" : "outline"}
                                                size="sm"
                                                onClick={() => toggleFilter('statuses', status.value)}
                                                className="h-8 text-xs justify-start"
                                            >
                                                <div className={cn('w-2 h-2 rounded-full mr-2', status.color)} />
                                                {status.label}
                                            </Button>
                                        ))}
                                    </div>
                                </div>

                                <Separator />

                                {/* Source Filter */}
                                <div className="space-y-2">
                                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Source</Label>
                                    <div className="space-y-1 max-h-32 overflow-y-auto">
                                        {uniqueSources.map(source => (
                                            <div key={source} className="flex items-center space-x-2">
                                                <Checkbox
                                                    id={`source-${source}`}
                                                    checked={filters.sources.includes(source)}
                                                    onCheckedChange={() => toggleFilter('sources', source)}
                                                />
                                                <label htmlFor={`source-${source}`} className="text-sm cursor-pointer">
                                                    {source}
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <Separator />

                                {/* Appointment Filter */}
                                <div className="space-y-2">
                                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Appointment</Label>
                                    <div className="flex gap-2">
                                        {(['all', 'booked', 'not_booked'] as const).map(value => (
                                            <Button
                                                key={value}
                                                variant={filters.hasAppointment === value ? "default" : "outline"}
                                                size="sm"
                                                onClick={() => setFilters(prev => ({ ...prev, hasAppointment: value }))}
                                                className="h-8 text-xs"
                                            >
                                                {value === 'all' ? 'All' : value === 'booked' ? 'Booked' : 'Not Booked'}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>

                    {/* Active filter badges */}
                    {activeFilterCount > 0 && (
                        <div className="flex items-center gap-1 flex-wrap">
                            {filters.priorityOnly && (
                                <Badge variant="secondary" className="gap-1 pr-1 border-yellow-500/20 bg-yellow-500/5 text-yellow-500">
                                    <Star className="h-3 w-3" />
                                    Priority
                                    <button onClick={() => setFilters(prev => ({ ...prev, priorityOnly: false }))} className="ml-1 hover:bg-yellow-500/10 rounded">
                                        <X className="h-3 w-3" />
                                    </button>
                                </Badge>
                            )}
                            {filters.statuses.map(status => (
                                <Badge key={status} variant="secondary" className="gap-1 pr-1">
                                    {status}
                                    <button onClick={() => toggleFilter('statuses', status)} className="ml-1 hover:bg-muted rounded">
                                        <X className="h-3 w-3" />
                                    </button>
                                </Badge>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Results count */}
            <div className="text-sm text-muted-foreground">
                Showing {filteredData.length} of {initialLeads.length} leads
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block rounded-md border border-zinc-800 bg-zinc-900/50 overflow-hidden">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-zinc-800 hover:bg-zinc-800/50">
                                <TableHead className="w-[40px]">
                                    <Checkbox
                                        checked={filteredData.length > 0 && selectedIds.size === filteredData.length}
                                        onCheckedChange={toggleSelectAll}
                                        aria-label="Select all"
                                    />
                                </TableHead>
                                <TableHead className="w-[40px] cursor-pointer hover:text-foreground" onClick={() => handleSort('priority')}>
                                    <Star className={cn("h-4 w-4", sortField === 'priority' && "text-yellow-500")} />
                                </TableHead>
                                <TableHead className="cursor-pointer hover:text-foreground" onClick={() => handleSort('name')}>
                                    Lead {sortField === 'name' && <ArrowUpDown className="ml-1 h-3 w-3 inline" />}
                                </TableHead>
                                <TableHead className="cursor-pointer hover:text-foreground" onClick={() => handleSort('status')}>
                                    Status {sortField === 'status' && <ArrowUpDown className="ml-1 h-3 w-3 inline" />}
                                </TableHead>
                                <TableHead>Journey</TableHead>
                                <TableHead className="cursor-pointer hover:text-foreground" onClick={() => handleSort('source')}>
                                    Source {sortField === 'source' && <ArrowUpDown className="ml-1 h-3 w-3 inline" />}
                                </TableHead>
                                <TableHead className="cursor-pointer hover:text-foreground" onClick={() => handleSort('setter')}>
                                    Setter {sortField === 'setter' && <ArrowUpDown className="ml-1 h-3 w-3 inline" />}
                                </TableHead>
                                <TableHead className="cursor-pointer hover:text-foreground" onClick={() => handleSort('closer')}>
                                    Closer {sortField === 'closer' && <ArrowUpDown className="ml-1 h-3 w-3 inline" />}
                                </TableHead>
                                <TableHead className="cursor-pointer hover:text-foreground" onClick={() => handleSort('appointment')}>
                                    Appointment {sortField === 'appointment' && <ArrowUpDown className="ml-1 h-3 w-3 inline" />}
                                </TableHead>
                                <TableHead className="cursor-pointer hover:text-foreground" onClick={() => handleSort('created_at')}>
                                    Age {sortField === 'created_at' && <ArrowUpDown className="ml-1 h-3 w-3 inline" />}
                                </TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredData.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={11} className="h-24 text-center text-zinc-500">
                                        No leads found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredData.map((lead) => {
                                    const journeySteps = getJourneySteps(lead)
                                    const age = getAgeDisplay(lead.created_at)
                                    const appointment = getAppointmentDisplay(lead)

                                    return (
                                        <TableRow
                                            key={lead.id}
                                            className={cn(
                                                "border-zinc-800 cursor-pointer hover:bg-zinc-800/50",
                                                selectedIds.has(lead.id) && "bg-primary/5"
                                            )}
                                            onClick={() => router.push(`/leads/${lead.id}`)}
                                        >
                                            <TableCell onClick={(e) => e.stopPropagation()}>
                                                <Checkbox
                                                    checked={selectedIds.has(lead.id)}
                                                    onCheckedChange={() => toggleSelect(lead.id)}
                                                    aria-label={`Select ${lead.first_name}`}
                                                />
                                            </TableCell>
                                            <TableCell onClick={(e) => handlePriorityToggle(e, lead.id)}>
                                                <Star className={cn(
                                                    "h-4 w-4 transition-colors",
                                                    lead.is_priority
                                                        ? "fill-yellow-500 text-yellow-500"
                                                        : "text-zinc-600 hover:text-yellow-500"
                                                )} />
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-zinc-200">
                                                        {lead.first_name} {lead.last_name}
                                                    </span>
                                                    <span className="text-xs text-zinc-500">{lead.email || '-'}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <span className={cn(
                                                    "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
                                                    getStatusColor(lead.status)
                                                )}>
                                                    {lead.status}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1" title={journeySteps.map(s => `${s.label}: ${s.done ? '✓' : '○'}`).join('\n')}>
                                                    {journeySteps.map((step, i) => (
                                                        <div
                                                            key={i}
                                                            className={cn(
                                                                "w-2 h-2 rounded-full",
                                                                step.done ? "bg-neon-green" : "bg-zinc-700"
                                                            )}
                                                        />
                                                    ))}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-zinc-400 capitalize">
                                                {lead.source || 'Unknown'}
                                            </TableCell>
                                            <TableCell>
                                                {lead.booked_by_user?.name || (
                                                    <span className="text-zinc-600 italic">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {lead.assigned_user?.name || (
                                                    <span className="text-zinc-600 italic">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <span className={appointment.color}>
                                                    {appointment.text}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <span className={age.color}>{age.text}</span>
                                            </TableCell>
                                            <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" className="h-8 w-8 p-0 text-zinc-400 hover:text-white">
                                                            <span className="sr-only">Open menu</span>
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800">
                                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                        <DropdownMenuItem onClick={(e) => openFollowUpDialog(e as unknown as React.MouseEvent, lead)}>
                                                            <Calendar className="mr-2 h-4 w-4" />
                                                            Schedule Follow-up
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={(e) => handleAddToQueue(e as unknown as React.MouseEvent, lead.id)}>
                                                            <ListPlus className="mr-2 h-4 w-4" />
                                                            Add to Call Queue
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => navigator.clipboard.writeText(lead.email || '')}>
                                                            <Copy className="mr-2 h-4 w-4" />
                                                            Copy Email
                                                        </DropdownMenuItem>
                                                        {lead.ghl_contact_id && !lead.ghl_contact_id.startsWith('manual_') && (
                                                            <DropdownMenuItem asChild>
                                                                <a
                                                                    href={`https://app.gohighlevel.com/contacts/detail/${lead.ghl_contact_id}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                >
                                                                    <ExternalLink className="mr-2 h-4 w-4" />
                                                                    View in GHL
                                                                </a>
                                                            </DropdownMenuItem>
                                                        )}
                                                        <DropdownMenuSeparator className="bg-zinc-800" />
                                                        <DropdownMenuItem
                                                            className="text-neon-green focus:text-neon-green focus:bg-neon-green/10"
                                                            onClick={(e) => handleConvert(e as unknown as React.MouseEvent, lead.id)}
                                                        >
                                                            <ArrowRight className="mr-2 h-4 w-4" />
                                                            Convert to Client
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            className="text-red-500 focus:text-red-500 focus:bg-red-500/10"
                                                            onClick={(e) => handleDelete(e as unknown as React.MouseEvent, lead.id)}
                                                        >
                                                            <Trash className="mr-2 h-4 w-4" />
                                                            Delete
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
                {filteredData.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
                        No leads found.
                    </div>
                ) : (
                    filteredData.map((lead) => {
                        const journeySteps = getJourneySteps(lead)
                        const appointment = getAppointmentDisplay(lead)

                        return (
                            <div
                                key={lead.id}
                                onClick={() => router.push(`/leads/${lead.id}`)}
                                className={cn(
                                    "bg-card/40 border border-primary/5 rounded-lg p-4 active:bg-muted/50 transition-colors cursor-pointer space-y-3 shadow-sm",
                                    selectedIds.has(lead.id) && "ring-1 ring-primary/30"
                                )}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="space-y-0.5">
                                        <div className="flex items-center gap-2">
                                            {lead.is_priority && (
                                                <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                                            )}
                                            <span className="font-semibold text-card-foreground">
                                                {lead.first_name} {lead.last_name}
                                            </span>
                                        </div>
                                        <div className="text-sm text-muted-foreground">{lead.email}</div>
                                    </div>
                                    <span className={cn(
                                        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border",
                                        getStatusColor(lead.status)
                                    )}>
                                        {lead.status}
                                    </span>
                                </div>

                                {/* Journey */}
                                <div className="flex items-center gap-1">
                                    {journeySteps.map((step, i) => (
                                        <div
                                            key={i}
                                            className={cn(
                                                "w-2 h-2 rounded-full",
                                                step.done ? "bg-neon-green" : "bg-zinc-700"
                                            )}
                                            title={step.label}
                                        />
                                    ))}
                                    <span className="text-xs text-muted-foreground ml-2">
                                        {journeySteps.filter(s => s.done).length}/{journeySteps.length}
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm pt-2 border-t border-primary/5 text-muted-foreground">
                                    <div>
                                        <span className="text-xs uppercase tracking-wide text-gray-500 block mb-0.5">Source</span>
                                        <span className="font-medium text-foreground capitalize">{lead.source || 'Unknown'}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-xs uppercase tracking-wide text-gray-500 block mb-0.5">Appointment</span>
                                        <span className={appointment.color}>{appointment.text}</span>
                                    </div>
                                </div>
                            </div>
                        )
                    })
                )}
            </div>

            {/* Bulk Actions Bar */}
            <LeadsBulkActionsBar
                selectedIds={selectedIds}
                selectedLeads={filteredData.filter(l => selectedIds.has(l.id))}
                users={users}
                onClear={clearSelection}
                onExport={exportToCSV}
            />

            {/* Follow-up Dialog */}
            {followUpLead && (
                <ScheduleFollowUpDialog
                    leadId={followUpLead.id}
                    leadName={followUpLead.name}
                    open={followUpDialogOpen}
                    onOpenChange={setFollowUpDialogOpen}
                />
            )}
        </div>
    )
}
