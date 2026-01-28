'use client'

import { useState, useMemo } from 'react'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { MoreHorizontal, Filter, X, CreditCard, ArrowUpDown } from 'lucide-react'
import { ClientType, EnhancedClient } from '@/types/client'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { AddClientDialog } from './AddClientDialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Coach } from '@/lib/actions/clients'
import { BulkActionsBar } from './BulkActionsBar'

interface ClientsTableProps {
    data: EnhancedClient[]
    clientTypes: ClientType[]
    coaches: Coach[]
    currentUserId?: string
}

type SortField = 'name' | 'status' | 'program' | 'coach' | 'start_date' | 'contract_end' | 'ltv' | 'onboarding'
type SortOrder = 'asc' | 'desc'

interface Filters {
    statuses: string[]
    programs: string[]
    coaches: string[]
    leadSources: string[]
    onlyMyClients: boolean
}

const STATUSES = [
    { value: 'active', label: 'Active', color: 'bg-emerald-500' },
    { value: 'inactive', label: 'Inactive', color: 'bg-gray-500' },
    { value: 'lost', label: 'Lost', color: 'bg-red-500' },
]

const LEAD_SOURCES = [
    { value: 'coach_driven', label: 'Coach Driven' },
    { value: 'company_driven', label: 'Company Driven' },
]

export function ClientsTable({ data, clientTypes, coaches, currentUserId }: ClientsTableProps) {
    const [searchTerm, setSearchTerm] = useState('')
    const [sortField, setSortField] = useState<SortField>('start_date')
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
    const [filters, setFilters] = useState<Filters>({
        statuses: [],
        programs: [],
        coaches: [],
        leadSources: [],
        onlyMyClients: false
    })
    const [isFilterOpen, setIsFilterOpen] = useState(false)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const router = useRouter()

    const activeFilterCount = useMemo(() => {
        return filters.statuses.length + filters.programs.length + filters.coaches.length + filters.leadSources.length + (filters.onlyMyClients ? 1 : 0)
    }, [filters])

    const filteredData = useMemo(() => {
        return data.filter((client) => {
            // Search filter
            const matchesSearch = searchTerm === '' ||
                client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                client.email.toLowerCase().includes(searchTerm.toLowerCase())

            // Status filter
            const matchesStatus = filters.statuses.length === 0 ||
                filters.statuses.includes(client.status)

            // Program filter
            const matchesProgram = filters.programs.length === 0 ||
                (client.client_type_id && filters.programs.includes(client.client_type_id)) ||
                (filters.programs.includes('unassigned') && !client.client_type_id)

            // Coach filter
            const matchesCoach = filters.coaches.length === 0 ||
                (client.assigned_coach_id && filters.coaches.includes(client.assigned_coach_id)) ||
                (filters.coaches.includes('unassigned') && !client.assigned_coach_id)

            // Lead source filter
            const matchesLeadSource = filters.leadSources.length === 0 ||
                (client.lead_source && filters.leadSources.includes(client.lead_source))

            // My Clients filter
            const matchesMyClients = !filters.onlyMyClients || (currentUserId && client.assigned_coach_id === currentUserId)

            return matchesSearch && matchesStatus && matchesProgram && matchesCoach && matchesLeadSource && matchesMyClients
        }).sort((a, b) => {
            let compareA: any = ''
            let compareB: any = ''

            switch (sortField) {
                case 'name':
                    compareA = a.name.toLowerCase()
                    compareB = b.name.toLowerCase()
                    break
                case 'status':
                    compareA = a.status
                    compareB = b.status
                    break
                case 'program':
                    compareA = a.client_type?.name || ''
                    compareB = b.client_type?.name || ''
                    break
                case 'coach':
                    compareA = a.assigned_coach?.name || ''
                    compareB = b.assigned_coach?.name || ''
                    break
                case 'start_date':
                    compareA = new Date(a.start_date).getTime()
                    compareB = new Date(b.start_date).getTime()
                    break
                case 'contract_end':
                    compareA = a.contract_end_date ? new Date(a.contract_end_date).getTime() : Infinity
                    compareB = b.contract_end_date ? new Date(b.contract_end_date).getTime() : Infinity
                    break
                case 'ltv':
                    compareA = a.lifetime_revenue || 0
                    compareB = b.lifetime_revenue || 0
                    break
                case 'onboarding':
                    compareA = a.open_tasks_count || 0
                    compareB = b.open_tasks_count || 0
                    break
            }

            if (compareA < compareB) return sortOrder === 'asc' ? -1 : 1
            if (compareA > compareB) return sortOrder === 'asc' ? 1 : -1
            return 0
        })
    }, [data, searchTerm, filters, sortField, sortOrder, currentUserId])

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
        } else {
            setSortField(field)
            setSortOrder('asc')
        }
    }

    const toggleFilter = (category: Exclude<keyof Filters, 'onlyMyClients'>, value: string) => {
        setFilters(prev => ({
            ...prev,
            [category]: prev[category].includes(value)
                // @ts-ignore - TS doesn't know for sure it's an array despite Exclude, but we know
                ? (prev[category] as string[]).filter(v => v !== value)
                : [...(prev[category] as string[]), value]
        }))
    }

    const clearFilters = () => {
        setFilters({
            statuses: [],
            programs: [],
            coaches: [],
            leadSources: [],
            onlyMyClients: false
        })
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active':
                return 'bg-emerald-500/15 text-emerald-500 border-emerald-500/20'
            case 'onboarding':
                return 'bg-yellow-500/15 text-yellow-500 border-yellow-500/20'
            case 'inactive':
                return 'bg-muted text-muted-foreground border-border'
            case 'lost':
                return 'bg-red-500/15 text-red-500 border-red-500/20'
            default:
                return 'bg-muted text-muted-foreground'
        }
    }

    // Selection helpers
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
            setSelectedIds(new Set(filteredData.map(c => c.id)))
        }
    }

    const clearSelection = () => setSelectedIds(new Set())

    const getContractEndStyle = (endDate: string | null | undefined) => {
        if (!endDate) return { color: 'text-muted-foreground', label: 'No Active Term' }
        const now = new Date()
        const end = new Date(endDate)
        const daysUntil = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

        if (daysUntil < 0) return { color: 'text-red-500', label: 'Expired' }
        if (daysUntil <= 14) return { color: 'text-red-500', label: format(end, 'MMM d, yyyy') }
        if (daysUntil <= 30) return { color: 'text-amber-500', label: format(end, 'MMM d, yyyy') }
        return { color: 'text-foreground', label: format(end, 'MMM d, yyyy') }
    }

    // LTV formatting
    const getLTVDisplay = (amount: number | undefined) => {
        const value = amount || 0
        const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
        if (value === 0) return { text: '$0', color: 'text-muted-foreground' }
        if (value >= 5000) return { text: formatted, color: 'text-emerald-500' }
        if (value >= 1000) return { text: formatted, color: 'text-foreground' }
        return { text: formatted, color: 'text-foreground' }
    }

    // Export selected clients to CSV
    const exportToCSV = () => {
        const clientsToExport = selectedIds.size > 0
            ? filteredData.filter(c => selectedIds.has(c.id))
            : filteredData

        const headers = ['Name', 'Email', 'Phone', 'Status', 'Program', 'Coach', 'Start Date', 'End Date', 'Lead Source']
        const rows = clientsToExport.map(c => [
            c.name,
            c.email,
            c.phone || '',
            c.status,
            c.client_type?.name || '',
            c.assigned_coach?.name || '',
            c.start_date ? format(new Date(c.start_date), 'yyyy-MM-dd') : '',
            c.contract_end_date ? format(new Date(c.contract_end_date), 'yyyy-MM-dd') : '',
            c.lead_source || ''
        ])

        const csvContent = [headers, ...rows]
            .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
            .join('\n')

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `clients-export-${format(new Date(), 'yyyy-MM-dd')}.csv`
        link.click()
        URL.revokeObjectURL(url)
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1">
                    <Input
                        placeholder="Search clients..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full md:max-w-sm bg-background border-border"
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

                                {currentUserId && (
                                    <>
                                        <div className="flex items-center space-x-2 bg-secondary/20 p-2 rounded-md">
                                            <Checkbox
                                                id="my-clients"
                                                checked={filters.onlyMyClients}
                                                onCheckedChange={(checked) => setFilters(prev => ({ ...prev, onlyMyClients: checked as boolean }))}
                                            />
                                            <label htmlFor="my-clients" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                                                My Clients Only
                                            </label>
                                        </div>
                                        <Separator />
                                    </>
                                )}

                                {/* Status Filter */}
                                <div className="space-y-2">
                                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</Label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {STATUSES.map(status => (
                                            <Button
                                                key={status.value}
                                                variant={filters.statuses.includes(status.value) ? "default" : "outline"}
                                                size="sm"
                                                onClick={() => toggleFilter('statuses', status.value)}
                                                className="h-8 text-xs justify-start"
                                            >
                                                <div className={`w-2 h-2 rounded-full mr-2 ${status.color}`} />
                                                {status.label}
                                            </Button>
                                        ))}
                                    </div>
                                </div>

                                <Separator />

                                {/* Program Filter */}
                                <div className="space-y-2">
                                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Program</Label>
                                    <div className="space-y-1 max-h-32 overflow-y-auto">
                                        <div className="flex items-center space-x-2">
                                            <Checkbox
                                                id="program-unassigned"
                                                checked={filters.programs.includes('unassigned')}
                                                onCheckedChange={() => toggleFilter('programs', 'unassigned')}
                                            />
                                            <label htmlFor="program-unassigned" className="text-sm text-muted-foreground italic cursor-pointer">
                                                Unassigned
                                            </label>
                                        </div>
                                        {clientTypes.map(type => (
                                            <div key={type.id} className="flex items-center space-x-2">
                                                <Checkbox
                                                    id={`program-${type.id}`}
                                                    checked={filters.programs.includes(type.id)}
                                                    onCheckedChange={() => toggleFilter('programs', type.id)}
                                                />
                                                <label htmlFor={`program-${type.id}`} className="text-sm cursor-pointer">
                                                    {type.name}
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <Separator />

                                {/* Coach Filter */}
                                <div className="space-y-2">
                                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Assigned Coach</Label>
                                    <div className="space-y-1 max-h-32 overflow-y-auto">
                                        <div className="flex items-center space-x-2">
                                            <Checkbox
                                                id="coach-unassigned"
                                                checked={filters.coaches.includes('unassigned')}
                                                onCheckedChange={() => toggleFilter('coaches', 'unassigned')}
                                            />
                                            <label htmlFor="coach-unassigned" className="text-sm text-muted-foreground italic cursor-pointer">
                                                Unassigned
                                            </label>
                                        </div>
                                        {coaches.map(coach => (
                                            <div key={coach.id} className="flex items-center space-x-2">
                                                <Checkbox
                                                    id={`coach-${coach.id}`}
                                                    checked={filters.coaches.includes(coach.id)}
                                                    onCheckedChange={() => toggleFilter('coaches', coach.id)}
                                                />
                                                <label htmlFor={`coach-${coach.id}`} className="text-sm cursor-pointer">
                                                    {coach.name}
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <Separator />

                                {/* Lead Source Filter */}
                                <div className="space-y-2">
                                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Lead Source</Label>
                                    <div className="flex gap-2">
                                        {LEAD_SOURCES.map(source => (
                                            <Button
                                                key={source.value}
                                                variant={filters.leadSources.includes(source.value) ? "default" : "outline"}
                                                size="sm"
                                                onClick={() => toggleFilter('leadSources', source.value)}
                                                className="h-8 text-xs"
                                            >
                                                {source.label}
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
                            {filters.statuses.map(status => (
                                <Badge key={status} variant="secondary" className="gap-1 pr-1">
                                    {status}
                                    <button onClick={() => toggleFilter('statuses', status)} className="ml-1 hover:bg-muted rounded">
                                        <X className="h-3 w-3" />
                                    </button>
                                </Badge>
                            ))}
                            {filters.programs.map(programId => {
                                const program = programId === 'unassigned' ? { name: 'Unassigned' } : clientTypes.find(t => t.id === programId)
                                return (
                                    <Badge key={programId} variant="secondary" className="gap-1 pr-1">
                                        {program?.name || programId}
                                        <button onClick={() => toggleFilter('programs', programId)} className="ml-1 hover:bg-muted rounded">
                                            <X className="h-3 w-3" />
                                        </button>
                                    </Badge>
                                )
                            })}
                            {filters.coaches.map(coachId => {
                                const coach = coachId === 'unassigned' ? { name: 'Unassigned' } : coaches.find(c => c.id === coachId)
                                return (
                                    <Badge key={coachId} variant="secondary" className="gap-1 pr-1">
                                        {coach?.name || coachId}
                                        <button onClick={() => toggleFilter('coaches', coachId)} className="ml-1 hover:bg-muted rounded">
                                            <X className="h-3 w-3" />
                                        </button>
                                    </Badge>
                                )
                            })}
                            {filters.leadSources.map(source => (
                                <Badge key={source} variant="secondary" className="gap-1 pr-1">
                                    {source.replace('_', ' ')}
                                    <button onClick={() => toggleFilter('leadSources', source)} className="ml-1 hover:bg-muted rounded">
                                        <X className="h-3 w-3" />
                                    </button>
                                </Badge>
                            ))}
                        </div>
                    )}
                    {filters.onlyMyClients && (
                        <Badge variant="secondary" className="gap-1 pr-1 border-primary/20 bg-primary/5 text-primary">
                            My Clients Only
                            <button onClick={() => setFilters(prev => ({ ...prev, onlyMyClients: false }))} className="ml-1 hover:bg-primary/10 rounded">
                                <X className="h-3 w-3" />
                            </button>
                        </Badge>
                    )}
                </div>
                <AddClientDialog clientTypes={clientTypes} />
            </div>

            {/* Results count */}
            <div className="text-sm text-muted-foreground">
                Showing {filteredData.length} of {data.length} clients
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block rounded-md border bg-card/40 border-primary/5 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[40px]">
                                    <Checkbox
                                        checked={filteredData.length > 0 && selectedIds.size === filteredData.length}
                                        onCheckedChange={toggleSelectAll}
                                        aria-label="Select all"
                                    />
                                </TableHead>
                                <TableHead className="w-[220px] cursor-pointer hover:text-foreground" onClick={() => handleSort('name')}>
                                    Client {sortField === 'name' && <ArrowUpDown className="ml-1 h-3 w-3 inline" />}
                                </TableHead>
                                <TableHead className="cursor-pointer hover:text-foreground" onClick={() => handleSort('status')}>
                                    Status {sortField === 'status' && <ArrowUpDown className="ml-1 h-3 w-3 inline" />}
                                </TableHead>
                                <TableHead className="cursor-pointer hover:text-foreground" onClick={() => handleSort('program')}>
                                    Program {sortField === 'program' && <ArrowUpDown className="ml-1 h-3 w-3 inline" />}
                                </TableHead>
                                <TableHead className="cursor-pointer hover:text-foreground" onClick={() => handleSort('coach')}>
                                    Coach {sortField === 'coach' && <ArrowUpDown className="ml-1 h-3 w-3 inline" />}
                                </TableHead>
                                <TableHead className="cursor-pointer hover:text-foreground" onClick={() => handleSort('start_date')}>
                                    Start {sortField === 'start_date' && <ArrowUpDown className="ml-1 h-3 w-3 inline" />}
                                </TableHead>
                                <TableHead className="cursor-pointer hover:text-foreground" onClick={() => handleSort('contract_end')}>
                                    End Date {sortField === 'contract_end' && <ArrowUpDown className="ml-1 h-3 w-3 inline" />}
                                </TableHead>
                                <TableHead className="cursor-pointer hover:text-foreground" onClick={() => handleSort('ltv')}>
                                    LTV {sortField === 'ltv' && <ArrowUpDown className="ml-1 h-3 w-3 inline" />}
                                </TableHead>
                                <TableHead className="cursor-pointer hover:text-foreground" onClick={() => handleSort('onboarding')}>
                                    Tasks {sortField === 'onboarding' && <ArrowUpDown className="ml-1 h-3 w-3 inline" />}
                                </TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredData.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={10} className="h-24 text-center">
                                        No results.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredData.map((client) => {
                                    const contractEnd = getContractEndStyle(client.contract_end_date)
                                    const ltv = getLTVDisplay(client.lifetime_revenue)

                                    return (
                                        <TableRow key={client.id} className={`cursor-pointer hover:bg-muted/50 border-border/50 ${selectedIds.has(client.id) ? 'bg-primary/5' : ''}`} onClick={() => router.push(`/clients/${client.id}`)}>
                                            <TableCell onClick={(e) => e.stopPropagation()}>
                                                <Checkbox
                                                    checked={selectedIds.has(client.id)}
                                                    onCheckedChange={() => toggleSelect(client.id)}
                                                    aria-label={`Select ${client.name}`}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-medium text-card-foreground">{client.name}</span>
                                                        <div
                                                            title={client.stripe_customer_id ? "Stripe Connected" : "No Stripe Account"}
                                                            className={client.stripe_customer_id ? "text-emerald-500" : "text-muted-foreground/30"}
                                                        >
                                                            <CreditCard className="h-3.5 w-3.5" />
                                                        </div>
                                                    </div>
                                                    <span className="text-xs text-muted-foreground">{client.email}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="secondary" className={getStatusColor(client.status)}>
                                                    {client.status.toUpperCase()}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <span className="whitespace-nowrap text-sm">
                                                    {client.client_type?.name || <span className="text-gray-400 italic">Unassigned</span>}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <span className="whitespace-nowrap text-sm">
                                                    {client.assigned_coach?.name || <span className="text-gray-400 italic">Unassigned</span>}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <span className="whitespace-nowrap text-sm">
                                                    {format(new Date(client.start_date), 'MMM d, yyyy')}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <span className={`whitespace-nowrap text-sm ${contractEnd.color}`}>
                                                    {contractEnd.label}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <span className={`whitespace-nowrap text-sm ${ltv.color}`}>
                                                    {ltv.text}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                {client.open_tasks_count && client.open_tasks_count > 0 ? (
                                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
                                                        {client.open_tasks_count} Open
                                                    </span>
                                                ) : (
                                                    <span className="text-sm text-muted-foreground">—</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" className="h-8 w-8 p-0" onClick={(e) => e.stopPropagation()}>
                                                            <span className="sr-only">Open menu</span>
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(client.id) }}>
                                                            Copy ID
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push(`/clients/${client.id}`) }}>
                                                            View details
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); }}>
                                                            View payments
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem className="text-red-600" onClick={(e) => { e.stopPropagation(); }}>
                                                            Archive client
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
                        No results found.
                    </div>
                ) : (
                    filteredData.map((client) => (
                        <div
                            key={client.id}
                            onClick={() => router.push(`/clients/${client.id}`)}
                            className="bg-card/40 border border-primary/5 rounded-lg p-4 active:bg-muted/50 transition-colors cursor-pointer space-y-3 shadow-sm"
                        >
                            <div className="flex items-start justify-between">
                                <div className="space-y-0.5">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-card-foreground text-lg">{client.name}</span>
                                        {client.stripe_customer_id && (
                                            <CreditCard className="h-3.5 w-3.5 text-emerald-500" />
                                        )}
                                    </div>
                                    <div className="text-sm text-muted-foreground">{client.email}</div>
                                </div>
                                <Badge variant="secondary" className={getStatusColor(client.status)}>
                                    {client.status.toUpperCase()}
                                </Badge>
                            </div>

                            <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm pt-2 border-t border-primary/5 text-muted-foreground">
                                <div>
                                    <span className="text-xs uppercase tracking-wide text-gray-500 block mb-0.5">Program</span>
                                    <span className="font-medium text-foreground">{client.client_type?.name || 'Unassigned'}</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-xs uppercase tracking-wide text-gray-500 block mb-0.5">Start Date</span>
                                    {format(new Date(client.start_date), 'MMM d, yyyy')}
                                </div>
                                <div className="col-span-2 pt-2">
                                    <span className="text-xs uppercase tracking-wide text-gray-500 block mb-0.5">Coach</span>
                                    <div className="flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full bg-primary/40"></div>
                                        <span className="font-medium text-foreground">{client.assigned_coach?.name || 'Unassigned'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Bulk Actions Bar */}
            <BulkActionsBar
                selectedIds={selectedIds}
                selectedClients={filteredData.filter(c => selectedIds.has(c.id))}
                coaches={coaches}
                onClear={clearSelection}
                onExport={exportToCSV}
            />
        </div>
    )
}
