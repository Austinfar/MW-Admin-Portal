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
import { MoreHorizontal, Filter, X, Check, CreditCard } from 'lucide-react'
import { Client, ClientType } from '@/types/client'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { AddClientDialog } from './AddClientDialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Coach } from '@/lib/actions/clients'

interface ClientsTableProps {
    data: Client[]
    clientTypes: ClientType[]
    coaches: Coach[]
}

interface Filters {
    statuses: string[]
    programs: string[]
    coaches: string[]
    leadSources: string[]
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

export function ClientsTable({ data, clientTypes, coaches }: ClientsTableProps) {
    const [searchTerm, setSearchTerm] = useState('')
    const [filters, setFilters] = useState<Filters>({
        statuses: [],
        programs: [],
        coaches: [],
        leadSources: [],
    })
    const [isFilterOpen, setIsFilterOpen] = useState(false)
    const router = useRouter()

    const activeFilterCount = useMemo(() => {
        return filters.statuses.length + filters.programs.length + filters.coaches.length + filters.leadSources.length
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

            return matchesSearch && matchesStatus && matchesProgram && matchesCoach && matchesLeadSource
        })
    }, [data, searchTerm, filters])

    const toggleFilter = (category: keyof Filters, value: string) => {
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
            programs: [],
            coaches: [],
            leadSources: [],
        })
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active':
                return 'bg-emerald-500/15 text-emerald-500 border-emerald-500/20'
            case 'inactive':
                return 'bg-muted text-muted-foreground border-border'
            case 'lost':
                return 'bg-red-500/15 text-red-500 border-red-500/20'
            default:
                return 'bg-muted text-muted-foreground'
        }
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
                                <TableHead className="w-[250px]">Client</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Program</TableHead>
                                <TableHead>Assigned Coach</TableHead>
                                <TableHead>Start Date</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredData.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">
                                        No results.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredData.map((client) => (
                                    <TableRow key={client.id} className="cursor-pointer hover:bg-muted/50 border-border/50" onClick={() => router.push(`/clients/${client.id}`)}>
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
                                            <span className="whitespace-nowrap">
                                                {client.client_type?.name || <span className="text-gray-400 italic">Unassigned</span>}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <span className="whitespace-nowrap">
                                                {client.assigned_coach?.name || <span className="text-gray-400 italic">Unassigned</span>}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <span className="whitespace-nowrap">
                                                {format(new Date(client.start_date), 'MMM d, yyyy')}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" className="h-8 w-8 p-0">
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
                                ))
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
        </div>
    )
}
