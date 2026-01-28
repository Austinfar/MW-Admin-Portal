'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import {
    MoreHorizontal,
    Filter,
    ArrowUpDown,
    AlertTriangle,
    Search,
    X,
} from 'lucide-react';
import { format } from 'date-fns';
import type { PaymentScheduleWithClientInfo } from '@/types/subscription';
import { ScheduleDetailSheet } from './ScheduleDetailSheet';

interface PaymentSchedulesTableProps {
    data: PaymentScheduleWithClientInfo[];
}

const SCHEDULE_STATUSES = [
    { value: 'draft', label: 'Draft', color: 'bg-gray-500' },
    { value: 'pending_initial', label: 'Pending Initial', color: 'bg-yellow-500' },
    { value: 'active', label: 'Active', color: 'bg-emerald-500' },
    { value: 'completed', label: 'Completed', color: 'bg-blue-500' },
    { value: 'cancelled', label: 'Cancelled', color: 'bg-red-500' },
];

type SortField = 'client' | 'plan' | 'status' | 'total' | 'remaining' | 'start_date' | 'created_at';
type SortDirection = 'asc' | 'desc';

function formatCurrency(cents: number): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(cents / 100);
}

function getStatusColor(status: string): string {
    const found = SCHEDULE_STATUSES.find(s => s.value === status);
    return found?.color || 'bg-gray-500';
}

// Calculate the actual remaining balance (sum of pending charges only)
function calculateActualRemaining(schedule: PaymentScheduleWithClientInfo): number {
    if (!schedule.scheduled_charges) return 0;
    return schedule.scheduled_charges
        .filter(c => c.status === 'pending')
        .reduce((sum, c) => sum + c.amount, 0);
}

export function PaymentSchedulesTable({ data }: PaymentSchedulesTableProps) {
    const router = useRouter();
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilters, setStatusFilters] = useState<string[]>([]);
    const [showWarningsOnly, setShowWarningsOnly] = useState(false);
    const [sortField, setSortField] = useState<SortField>('created_at');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
    const [selectedSchedule, setSelectedSchedule] = useState<PaymentScheduleWithClientInfo | null>(null);
    const [isSheetOpen, setIsSheetOpen] = useState(false);

    const toggleStatusFilter = (status: string) => {
        setStatusFilters(prev =>
            prev.includes(status)
                ? prev.filter(s => s !== status)
                : [...prev, status]
        );
    };

    const clearFilters = () => {
        setStatusFilters([]);
        setShowWarningsOnly(false);
        setSearchTerm('');
    };

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const openScheduleDetail = (schedule: PaymentScheduleWithClientInfo) => {
        setSelectedSchedule(schedule);
        setIsSheetOpen(true);
    };

    const navigateToClient = (clientId: string) => {
        router.push(`/clients/${clientId}`);
    };

    const filteredAndSortedData = useMemo(() => {
        let filtered = data;

        // Search filter
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(
                s =>
                    s.client?.name?.toLowerCase().includes(term) ||
                    s.client?.email?.toLowerCase().includes(term) ||
                    s.plan_name?.toLowerCase().includes(term)
            );
        }

        // Status filter
        if (statusFilters.length > 0) {
            filtered = filtered.filter(s => statusFilters.includes(s.status));
        }

        // Warning filter
        if (showWarningsOnly) {
            filtered = filtered.filter(s => s.hasClientWarning);
        }

        // Sort
        filtered = [...filtered].sort((a, b) => {
            let aVal: string | number = '';
            let bVal: string | number = '';

            switch (sortField) {
                case 'client':
                    aVal = a.client?.name?.toLowerCase() || '';
                    bVal = b.client?.name?.toLowerCase() || '';
                    break;
                case 'plan':
                    aVal = a.plan_name?.toLowerCase() || '';
                    bVal = b.plan_name?.toLowerCase() || '';
                    break;
                case 'status':
                    aVal = a.status || '';
                    bVal = b.status || '';
                    break;
                case 'total':
                    aVal = a.total_amount || 0;
                    bVal = b.total_amount || 0;
                    break;
                case 'remaining':
                    aVal = calculateActualRemaining(a);
                    bVal = calculateActualRemaining(b);
                    break;
                case 'start_date':
                    aVal = a.start_date ? new Date(a.start_date).getTime() : 0;
                    bVal = b.start_date ? new Date(b.start_date).getTime() : 0;
                    break;
                case 'created_at':
                    aVal = a.created_at ? new Date(a.created_at).getTime() : 0;
                    bVal = b.created_at ? new Date(b.created_at).getTime() : 0;
                    break;
            }

            if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });

        return filtered;
    }, [data, searchTerm, statusFilters, showWarningsOnly, sortField, sortDirection]);

    const hasActiveFilters = statusFilters.length > 0 || showWarningsOnly || searchTerm;
    const warningCount = data.filter(s => s.hasClientWarning).length;

    return (
        <div className="space-y-4">
            {/* Search and Filter Bar */}
            <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Search by client or plan..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="pl-9"
                    />
                </div>

                {/* Status Filter Popover */}
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="relative">
                            <Filter className="h-4 w-4 mr-2" />
                            Status
                            {statusFilters.length > 0 && (
                                <Badge
                                    variant="secondary"
                                    className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs"
                                >
                                    {statusFilters.length}
                                </Badge>
                            )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56" align="start">
                        <div className="space-y-2">
                            <p className="text-sm font-medium">Filter by Status</p>
                            {SCHEDULE_STATUSES.map(status => (
                                <div
                                    key={status.value}
                                    className="flex items-center space-x-2"
                                >
                                    <Checkbox
                                        id={status.value}
                                        checked={statusFilters.includes(status.value)}
                                        onCheckedChange={() => toggleStatusFilter(status.value)}
                                    />
                                    <label
                                        htmlFor={status.value}
                                        className="text-sm cursor-pointer flex items-center gap-2"
                                    >
                                        <span
                                            className={`h-2 w-2 rounded-full ${status.color}`}
                                        />
                                        {status.label}
                                    </label>
                                </div>
                            ))}
                        </div>
                    </PopoverContent>
                </Popover>

                {/* Warning Filter Toggle */}
                {warningCount > 0 && (
                    <Button
                        variant={showWarningsOnly ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setShowWarningsOnly(!showWarningsOnly)}
                        className={showWarningsOnly ? 'bg-red-600 hover:bg-red-700' : ''}
                    >
                        <AlertTriangle className="h-4 w-4 mr-2" />
                        Warnings ({warningCount})
                    </Button>
                )}

                {/* Clear Filters */}
                {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={clearFilters}>
                        <X className="h-4 w-4 mr-1" />
                        Clear
                    </Button>
                )}
            </div>

            {/* Results count */}
            <div className="text-sm text-muted-foreground">
                Showing {filteredAndSortedData.length} of {data.length} schedules
            </div>

            {/* Table */}
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead
                                className="cursor-pointer hover:bg-muted/50"
                                onClick={() => handleSort('client')}
                            >
                                <div className="flex items-center">
                                    Client
                                    <ArrowUpDown className="ml-1 h-3 w-3" />
                                </div>
                            </TableHead>
                            <TableHead
                                className="cursor-pointer hover:bg-muted/50"
                                onClick={() => handleSort('plan')}
                            >
                                <div className="flex items-center">
                                    Plan
                                    <ArrowUpDown className="ml-1 h-3 w-3" />
                                </div>
                            </TableHead>
                            <TableHead
                                className="cursor-pointer hover:bg-muted/50"
                                onClick={() => handleSort('status')}
                            >
                                <div className="flex items-center">
                                    Status
                                    <ArrowUpDown className="ml-1 h-3 w-3" />
                                </div>
                            </TableHead>
                            <TableHead
                                className="cursor-pointer hover:bg-muted/50 text-right"
                                onClick={() => handleSort('total')}
                            >
                                <div className="flex items-center justify-end">
                                    Total
                                    <ArrowUpDown className="ml-1 h-3 w-3" />
                                </div>
                            </TableHead>
                            <TableHead
                                className="cursor-pointer hover:bg-muted/50 text-right"
                                onClick={() => handleSort('remaining')}
                            >
                                <div className="flex items-center justify-end">
                                    Remaining
                                    <ArrowUpDown className="ml-1 h-3 w-3" />
                                </div>
                            </TableHead>
                            <TableHead
                                className="cursor-pointer hover:bg-muted/50"
                                onClick={() => handleSort('start_date')}
                            >
                                <div className="flex items-center">
                                    Start Date
                                    <ArrowUpDown className="ml-1 h-3 w-3" />
                                </div>
                            </TableHead>
                            <TableHead className="w-[50px]">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredAndSortedData.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center">
                                    No payment schedules found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredAndSortedData.map(schedule => (
                                <TableRow
                                    key={schedule.id}
                                    className="cursor-pointer hover:bg-muted/50"
                                    onClick={() => openScheduleDetail(schedule)}
                                >
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium">
                                                {schedule.client?.name || 'No Client'}
                                            </span>
                                            {schedule.hasClientWarning && (
                                                <Badge
                                                    variant="destructive"
                                                    className="gap-1 text-xs"
                                                    title="Client is inactive/lost but has pending charges"
                                                >
                                                    <AlertTriangle className="h-3 w-3" />
                                                    {schedule.client?.status}
                                                </Badge>
                                            )}
                                        </div>
                                        {schedule.client?.email && (
                                            <div className="text-xs text-muted-foreground">
                                                {schedule.client.email}
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-sm">
                                            {schedule.plan_name || 'Payment Plan'}
                                        </span>
                                        {schedule.pendingChargesCount > 0 && (
                                            <div className="text-xs text-muted-foreground">
                                                {schedule.pendingChargesCount} pending charge
                                                {schedule.pendingChargesCount !== 1 ? 's' : ''}
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            className={`${getStatusColor(schedule.status)} text-white`}
                                        >
                                            {schedule.status?.replace('_', ' ').toUpperCase()}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right font-medium">
                                        {formatCurrency(schedule.total_amount || 0)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {(() => {
                                            const actualRemaining = calculateActualRemaining(schedule);
                                            return (
                                                <span
                                                    className={
                                                        actualRemaining > 0
                                                            ? 'text-amber-500 font-medium'
                                                            : 'text-emerald-500'
                                                    }
                                                >
                                                    {formatCurrency(actualRemaining)}
                                                </span>
                                            );
                                        })()}
                                    </TableCell>
                                    <TableCell>
                                        {schedule.start_date
                                            ? format(new Date(schedule.start_date), 'MMM d, yyyy')
                                            : '-'}
                                    </TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={e => e.stopPropagation()}
                                                >
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem
                                                    onClick={e => {
                                                        e.stopPropagation();
                                                        openScheduleDetail(schedule);
                                                    }}
                                                >
                                                    View Details
                                                </DropdownMenuItem>
                                                {schedule.client?.id && (
                                                    <DropdownMenuItem
                                                        onClick={e => {
                                                            e.stopPropagation();
                                                            navigateToClient(schedule.client!.id);
                                                        }}
                                                    >
                                                        Go to Client
                                                    </DropdownMenuItem>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Schedule Detail Sheet */}
            <ScheduleDetailSheet
                schedule={selectedSchedule}
                open={isSheetOpen}
                onOpenChange={setIsSheetOpen}
            />
        </div>
    );
}
