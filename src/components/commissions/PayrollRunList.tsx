'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { getPayrollHistory, PayrollRun } from '@/lib/actions/payroll'
import { formatCurrency, cn } from '@/lib/utils'
import { Loader2, Eye, FileText, CheckCircle, XCircle, Clock, Ban } from 'lucide-react'

interface PayrollRunListProps {
    onSelectRun: (runId: string) => void
    selectedRunId?: string
}

const STATUS_CONFIG: Record<string, { label: string; icon: typeof Clock; color: string; bgColor: string }> = {
    draft: {
        label: 'Draft',
        icon: FileText,
        color: 'text-yellow-400',
        bgColor: 'bg-yellow-500/20 border-yellow-500/30'
    },
    approved: {
        label: 'Approved',
        icon: CheckCircle,
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/20 border-blue-500/30'
    },
    paid: {
        label: 'Paid',
        icon: CheckCircle,
        color: 'text-emerald-400',
        bgColor: 'bg-emerald-500/20 border-emerald-500/30'
    },
    void: {
        label: 'Voided',
        icon: Ban,
        color: 'text-gray-400',
        bgColor: 'bg-gray-500/20 border-gray-500/30'
    }
}

export function PayrollRunList({ onSelectRun, selectedRunId }: PayrollRunListProps) {
    const [runs, setRuns] = useState<PayrollRun[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchRuns() {
            try {
                const data = await getPayrollHistory()
                setRuns(data)
            } catch (error) {
                console.error('Failed to fetch payroll runs:', error)
            } finally {
                setLoading(false)
            }
        }
        fetchRuns()
    }, [])

    if (loading) {
        return (
            <Card className="bg-card/40 border-white/5 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle>Payroll Runs</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </CardContent>
            </Card>
        )
    }

    if (runs.length === 0) {
        return (
            <Card className="bg-card/40 border-white/5 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle>Payroll Runs</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <FileText className="h-8 w-8 mb-2 opacity-50" />
                    <p className="text-sm">No payroll runs found</p>
                    <p className="text-xs mt-1">Create a draft from the Active Pay Period tab</p>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="bg-card/40 border-white/5 backdrop-blur-sm">
            <CardHeader>
                <CardTitle>Payroll Runs</CardTitle>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-white/5 border-white/10">
                            <TableHead>Period</TableHead>
                            <TableHead>Payout Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Total</TableHead>
                            <TableHead>Transactions</TableHead>
                            <TableHead>Created By</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {runs.map((run) => {
                            const statusConfig = STATUS_CONFIG[run.status] || STATUS_CONFIG.draft
                            const StatusIcon = statusConfig.icon
                            const isSelected = selectedRunId === run.id

                            return (
                                <TableRow
                                    key={run.id}
                                    className={cn(
                                        "hover:bg-white/5 border-white/10 cursor-pointer transition-colors",
                                        isSelected && "bg-white/10"
                                    )}
                                    onClick={() => onSelectRun(run.id)}
                                >
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-medium">
                                                {format(new Date(run.period_start), 'MMM d')} - {format(new Date(run.period_end), 'MMM d, yyyy')}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {format(new Date(run.payout_date), 'MMM d, yyyy')}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={cn("text-xs", statusConfig.bgColor, statusConfig.color)}>
                                            <StatusIcon className="h-3 w-3 mr-1" />
                                            {statusConfig.label}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="font-medium text-emerald-400">
                                        {formatCurrency(run.total_payout || 0)}
                                    </TableCell>
                                    <TableCell>{run.transaction_count || 0}</TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {run.creator?.name || 'Unknown'}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                onSelectRun(run.id)
                                            }}
                                        >
                                            <Eye className="h-4 w-4 mr-1" />
                                            View
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    )
}
