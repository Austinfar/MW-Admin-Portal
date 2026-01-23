'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    ChevronLeft,
    ChevronRight,
    CheckCircle2,
    XCircle,
    Clock,
    RefreshCw,
    Send,
    AlertTriangle,
    Calendar,
    Filter
} from 'lucide-react'
import { getSmsCheckinLogs, getSmsLogsStats, SmsCheckinLog, SmsLogsFilter, SmsLogsStats } from '@/lib/actions/sms-checkin'
import { format, subDays } from 'date-fns'

interface SmsCheckinLogsProps {
    initialLogs: SmsCheckinLog[]
    initialTotal: number
}

type DatePreset = 'today' | 'yesterday' | 'last7' | 'last30' | 'custom' | 'all'

export function SmsCheckinLogs({ initialLogs, initialTotal }: SmsCheckinLogsProps) {
    const [logs, setLogs] = useState(initialLogs)
    const [total, setTotal] = useState(initialTotal)
    const [stats, setStats] = useState<SmsLogsStats | null>(null)
    const [page, setPage] = useState(0)
    const [isLoading, setIsLoading] = useState(false)

    // Filters
    const [datePreset, setDatePreset] = useState<DatePreset>('all')
    const [customDateFrom, setCustomDateFrom] = useState('')
    const [customDateTo, setCustomDateTo] = useState('')
    const [statusFilter, setStatusFilter] = useState<'all' | 'sent' | 'failed'>('all')

    const pageSize = 25

    const totalPages = Math.ceil(total / pageSize)

    // Load stats on mount
    useEffect(() => {
        loadStats()
    }, [])

    const loadStats = async () => {
        const statsData = await getSmsLogsStats()
        setStats(statsData)
    }

    const getDateRange = (): { dateFrom?: string; dateTo?: string } => {
        const today = new Date()
        switch (datePreset) {
            case 'today':
                return { dateFrom: format(today, 'yyyy-MM-dd'), dateTo: format(today, 'yyyy-MM-dd') }
            case 'yesterday':
                const yesterday = subDays(today, 1)
                return { dateFrom: format(yesterday, 'yyyy-MM-dd'), dateTo: format(yesterday, 'yyyy-MM-dd') }
            case 'last7':
                return { dateFrom: format(subDays(today, 7), 'yyyy-MM-dd'), dateTo: format(today, 'yyyy-MM-dd') }
            case 'last30':
                return { dateFrom: format(subDays(today, 30), 'yyyy-MM-dd'), dateTo: format(today, 'yyyy-MM-dd') }
            case 'custom':
                return { dateFrom: customDateFrom || undefined, dateTo: customDateTo || undefined }
            default:
                return {}
        }
    }

    const loadPage = async (newPage: number, resetPage = false) => {
        setIsLoading(true)
        try {
            const dateRange = getDateRange()
            const filters: SmsLogsFilter = {
                ...dateRange,
                status: statusFilter
            }
            const targetPage = resetPage ? 0 : newPage
            const { data, total: newTotal } = await getSmsCheckinLogs(pageSize, targetPage * pageSize, filters)
            setLogs(data)
            setTotal(newTotal)
            setPage(targetPage)
        } catch (error) {
            console.error('Failed to load logs:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const applyFilters = () => {
        loadPage(0, true)
        loadStats()
    }

    const clearFilters = () => {
        setDatePreset('all')
        setCustomDateFrom('')
        setCustomDateTo('')
        setStatusFilter('all')
        // Reload with no filters
        setTimeout(() => loadPage(0, true), 0)
    }

    const refresh = () => {
        loadPage(page)
        loadStats()
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'sent':
                return (
                    <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-500 border-emerald-500/20 gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Sent
                    </Badge>
                )
            case 'failed':
                return (
                    <Badge variant="secondary" className="bg-red-500/15 text-red-500 border-red-500/20 gap-1">
                        <XCircle className="h-3 w-3" />
                        Failed
                    </Badge>
                )
            case 'pending':
            default:
                return (
                    <Badge variant="secondary" className="gap-1">
                        <Clock className="h-3 w-3" />
                        Pending
                    </Badge>
                )
        }
    }

    const hasActiveFilters = datePreset !== 'all' || statusFilter !== 'all'

    return (
        <div className="space-y-4">
            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Card className="bg-card/50 backdrop-blur-xl border-white/5">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-2">
                                <Send className="h-4 w-4 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">Total Sent</span>
                            </div>
                            <p className="text-2xl font-bold mt-1">{stats.sent}</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-card/50 backdrop-blur-xl border-white/5">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-red-500" />
                                <span className="text-xs text-muted-foreground">Total Failed</span>
                            </div>
                            <p className="text-2xl font-bold mt-1 text-red-500">{stats.failed}</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-card/50 backdrop-blur-xl border-white/5">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                <span className="text-xs text-muted-foreground">Today Sent</span>
                            </div>
                            <p className="text-2xl font-bold mt-1 text-emerald-500">{stats.todaySent}</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-card/50 backdrop-blur-xl border-white/5">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-2">
                                <XCircle className="h-4 w-4 text-amber-500" />
                                <span className="text-xs text-muted-foreground">Today Failed</span>
                            </div>
                            <p className="text-2xl font-bold mt-1 text-amber-500">{stats.todayFailed}</p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Filters */}
            <Card className="bg-card/50 backdrop-blur-xl border-white/5">
                <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row gap-3">
                        {/* Date Preset */}
                        <div className="flex-1">
                            <label className="text-xs text-muted-foreground mb-1 block">Date Range</label>
                            <Select value={datePreset} onValueChange={(v) => setDatePreset(v as DatePreset)}>
                                <SelectTrigger>
                                    <Calendar className="h-4 w-4 mr-2" />
                                    <SelectValue placeholder="Select date range" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Time</SelectItem>
                                    <SelectItem value="today">Today</SelectItem>
                                    <SelectItem value="yesterday">Yesterday</SelectItem>
                                    <SelectItem value="last7">Last 7 Days</SelectItem>
                                    <SelectItem value="last30">Last 30 Days</SelectItem>
                                    <SelectItem value="custom">Custom Range</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Custom Date Inputs */}
                        {datePreset === 'custom' && (
                            <>
                                <div className="flex-1">
                                    <label className="text-xs text-muted-foreground mb-1 block">From</label>
                                    <Input
                                        type="date"
                                        value={customDateFrom}
                                        onChange={(e) => setCustomDateFrom(e.target.value)}
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="text-xs text-muted-foreground mb-1 block">To</label>
                                    <Input
                                        type="date"
                                        value={customDateTo}
                                        onChange={(e) => setCustomDateTo(e.target.value)}
                                    />
                                </div>
                            </>
                        )}

                        {/* Status Filter */}
                        <div className="w-full sm:w-40">
                            <label className="text-xs text-muted-foreground mb-1 block">Status</label>
                            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'all' | 'sent' | 'failed')}>
                                <SelectTrigger>
                                    <Filter className="h-4 w-4 mr-2" />
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Status</SelectItem>
                                    <SelectItem value="sent">Sent Only</SelectItem>
                                    <SelectItem value="failed">Failed Only</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Filter Actions */}
                        <div className="flex gap-2 items-end">
                            <Button onClick={applyFilters} disabled={isLoading}>
                                Apply
                            </Button>
                            {hasActiveFilters && (
                                <Button variant="outline" onClick={clearFilters} disabled={isLoading}>
                                    Clear
                                </Button>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Logs Table */}
            <Card className="bg-card/50 backdrop-blur-xl border-white/5">
                <CardContent className="p-0">
                    {/* Header with count and refresh */}
                    <div className="flex items-center justify-between p-4 border-b border-white/5">
                        <p className="text-sm text-muted-foreground">
                            {total} messages {hasActiveFilters && '(filtered)'}
                        </p>
                        <Button variant="outline" size="sm" onClick={refresh} disabled={isLoading}>
                            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                    </div>

                    {logs.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <p>No messages found</p>
                            {hasActiveFilters && (
                                <p className="text-sm mt-1">Try adjusting your filters</p>
                            )}
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Client</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Sent At</TableHead>
                                            <TableHead>Details</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {logs.map((log) => (
                                            <TableRow key={log.id} className={log.status === 'failed' ? 'bg-red-500/5' : ''}>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="font-medium">{log.client?.name || 'Unknown'}</span>
                                                        <span className="text-xs text-muted-foreground">{log.client?.email}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {getStatusBadge(log.status)}
                                                </TableCell>
                                                <TableCell>
                                                    <span className="text-sm text-muted-foreground whitespace-nowrap">
                                                        {format(new Date(log.sent_at), 'MMM d, yyyy')}
                                                    </span>
                                                    <br />
                                                    <span className="text-xs text-muted-foreground">
                                                        {format(new Date(log.sent_at), 'h:mm a')}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    {log.status === 'failed' && log.error_message ? (
                                                        <div className="max-w-xs">
                                                            <p className="text-xs text-red-500 font-medium">Error:</p>
                                                            <p className="text-xs text-red-400 truncate" title={log.error_message}>
                                                                {log.error_message}
                                                            </p>
                                                        </div>
                                                    ) : (
                                                        <p className="text-xs text-muted-foreground max-w-xs truncate" title={log.message}>
                                                            {log.message}
                                                        </p>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="flex items-center justify-between p-4 border-t border-white/5">
                                    <p className="text-sm text-muted-foreground">
                                        Page {page + 1} of {totalPages}
                                    </p>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => loadPage(page - 1)}
                                            disabled={page === 0 || isLoading}
                                        >
                                            <ChevronLeft className="h-4 w-4" />
                                            Previous
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => loadPage(page + 1)}
                                            disabled={page >= totalPages - 1 || isLoading}
                                        >
                                            Next
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
