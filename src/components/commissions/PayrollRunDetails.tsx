'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
    getPayrollStats,
    getPayrollRun,
    approvePayrollRun,
    markPayrollPaid,
    voidPayrollRun,
    generateSummaryExport,
    generateDetailedExport,
    PayrollRun,
    PayrollStats
} from '@/lib/actions/payroll'
import { formatCurrency, cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
    Loader2,
    ArrowLeft,
    CheckCircle,
    DollarSign,
    XCircle,
    Download,
    FileText,
    User,
    Calendar,
    AlertTriangle
} from 'lucide-react'
import { CommissionLedgerTable } from './CommissionLedgerTable'
import { AdjustmentsList } from './AdjustmentsList'
import { AddAdjustmentDialog } from './AddAdjustmentDialog'

interface PayrollRunDetailsProps {
    runId: string
    onBack: () => void
    canApprove: boolean
}

export function PayrollRunDetails({ runId, onBack, canApprove }: PayrollRunDetailsProps) {
    const [run, setRun] = useState<PayrollRun | null>(null)
    const [stats, setStats] = useState<PayrollStats | null>(null)
    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [voidDialogOpen, setVoidDialogOpen] = useState(false)
    const [voidReason, setVoidReason] = useState('')
    const [currentUserId, setCurrentUserId] = useState<string | null>(null)

    useEffect(() => {
        async function fetchData() {
            setLoading(true)
            try {
                const [runData, statsData] = await Promise.all([
                    getPayrollRun(runId),
                    getPayrollStats(new Date(), new Date(), { payrollRunId: runId })
                ])
                setRun(runData)
                setStats(statsData)

                // Get current user ID for two-person rule check
                const { getCurrentUserProfile } = await import('@/lib/actions/profile')
                const profile = await getCurrentUserProfile()
                if (profile) {
                    setCurrentUserId(profile.id)
                }
            } catch (error) {
                console.error('Failed to fetch run details:', error)
                toast.error('Failed to load payroll run details')
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [runId])

    async function handleApprove() {
        setActionLoading('approve')
        try {
            const result = await approvePayrollRun(runId)
            if (result.error) {
                toast.error(result.error)
            } else {
                toast.success('Payroll run approved!')
                const updatedRun = await getPayrollRun(runId)
                setRun(updatedRun)
            }
        } catch (error) {
            console.error('Failed to approve:', error)
            toast.error('Failed to approve payroll run')
        } finally {
            setActionLoading(null)
        }
    }

    async function handleMarkPaid() {
        setActionLoading('paid')
        try {
            const result = await markPayrollPaid(runId)
            if (result.error) {
                toast.error(result.error)
            } else {
                toast.success('Payroll marked as paid!')
                const updatedRun = await getPayrollRun(runId)
                setRun(updatedRun)
            }
        } catch (error) {
            console.error('Failed to mark paid:', error)
            toast.error('Failed to mark payroll as paid')
        } finally {
            setActionLoading(null)
        }
    }

    async function handleVoid() {
        if (voidReason.trim().length < 10) {
            toast.error('Please provide a reason (at least 10 characters)')
            return
        }

        setActionLoading('void')
        try {
            const result = await voidPayrollRun(runId, voidReason)
            if (result.error) {
                toast.error(result.error)
            } else {
                toast.success('Payroll run voided')
                setVoidDialogOpen(false)
                const updatedRun = await getPayrollRun(runId)
                setRun(updatedRun)
            }
        } catch (error) {
            console.error('Failed to void:', error)
            toast.error('Failed to void payroll run')
        } finally {
            setActionLoading(null)
        }
    }

    async function handleExport(type: 'summary' | 'detailed') {
        setActionLoading(`export-${type}`)
        try {
            const csvContent = type === 'summary'
                ? await generateSummaryExport(runId)
                : await generateDetailedExport(runId)

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.setAttribute('download', `payroll_${type}_${runId.substring(0, 8)}.csv`)
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            toast.success('Export downloaded')
        } catch (error) {
            console.error('Failed to export:', error)
            toast.error('Failed to generate export')
        } finally {
            setActionLoading(null)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (!run || !stats) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
                <AlertTriangle className="h-8 w-8 mb-2" />
                <p>Failed to load payroll run</p>
                <Button variant="ghost" onClick={onBack} className="mt-4">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to list
                </Button>
            </div>
        )
    }

    const canApproveThisRun = canApprove && run.status === 'draft' && run.created_by !== currentUserId
    const canMarkPaid = run.status === 'approved'
    const canVoid = run.status === 'draft' || run.status === 'approved'

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={onBack}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h2 className="text-xl font-bold">
                            {format(new Date(run.period_start), 'MMM d')} - {format(new Date(run.period_end), 'MMM d, yyyy')}
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            Payout: {format(new Date(run.payout_date), 'MMMM d, yyyy')}
                        </p>
                    </div>
                    <Badge
                        variant="outline"
                        className={cn(
                            "ml-2",
                            run.status === 'paid' && "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
                            run.status === 'approved' && "bg-blue-500/20 text-blue-400 border-blue-500/30",
                            run.status === 'draft' && "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
                            run.status === 'void' && "bg-gray-500/20 text-gray-400 border-gray-500/30"
                        )}
                    >
                        {run.status.charAt(0).toUpperCase() + run.status.slice(1)}
                    </Badge>
                </div>

                <div className="flex gap-2 flex-wrap">
                    <Button
                        variant="outline"
                        onClick={() => handleExport('summary')}
                        disabled={actionLoading === 'export-summary'}
                    >
                        {actionLoading === 'export-summary' ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Download className="mr-2 h-4 w-4" />
                        )}
                        Summary CSV
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => handleExport('detailed')}
                        disabled={actionLoading === 'export-detailed'}
                    >
                        {actionLoading === 'export-detailed' ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <FileText className="mr-2 h-4 w-4" />
                        )}
                        Detailed CSV
                    </Button>

                    {canApproveThisRun && (
                        <Button
                            className="bg-blue-600 hover:bg-blue-500"
                            onClick={handleApprove}
                            disabled={actionLoading === 'approve'}
                        >
                            {actionLoading === 'approve' ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <CheckCircle className="mr-2 h-4 w-4" />
                            )}
                            Approve
                        </Button>
                    )}

                    {run.status === 'draft' && run.created_by === currentUserId && (
                        <p className="text-xs text-yellow-400 self-center">
                            Requires approval from another admin
                        </p>
                    )}

                    {canMarkPaid && (
                        <Button
                            className="bg-emerald-600 hover:bg-emerald-500"
                            onClick={handleMarkPaid}
                            disabled={actionLoading === 'paid'}
                        >
                            {actionLoading === 'paid' ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <DollarSign className="mr-2 h-4 w-4" />
                            )}
                            Mark as Paid
                        </Button>
                    )}

                    {canVoid && (
                        <Dialog open={voidDialogOpen} onOpenChange={setVoidDialogOpen}>
                            <DialogTrigger asChild>
                                <Button variant="destructive">
                                    <XCircle className="mr-2 h-4 w-4" />
                                    Void
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Void Payroll Run</DialogTitle>
                                    <DialogDescription>
                                        This will release all entries back to pending status. This action cannot be undone.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="void-reason">Reason for voiding</Label>
                                        <Textarea
                                            id="void-reason"
                                            placeholder="Explain why this run is being voided..."
                                            value={voidReason}
                                            onChange={(e) => setVoidReason(e.target.value)}
                                            rows={3}
                                        />
                                        <p className="text-xs text-muted-foreground">Minimum 10 characters required</p>
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setVoidDialogOpen(false)}>Cancel</Button>
                                    <Button
                                        variant="destructive"
                                        onClick={handleVoid}
                                        disabled={actionLoading === 'void' || voidReason.trim().length < 10}
                                    >
                                        {actionLoading === 'void' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Void Run
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    )}
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-card/40 border-white/5">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Commission Total</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-500">
                            {formatCurrency(stats.totalCommission)}
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-card/40 border-white/5">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Adjustments</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className={cn(
                            "text-2xl font-bold",
                            stats.totalAdjustments >= 0 ? "text-blue-400" : "text-red-400"
                        )}>
                            {stats.totalAdjustments >= 0 ? '+' : ''}{formatCurrency(stats.totalAdjustments)}
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-card/40 border-white/5">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Total Payout</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-purple-400">
                            {formatCurrency(stats.totalPayout)}
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-card/40 border-white/5">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Transactions</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.transactionCount}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Audit Trail */}
            <Card className="bg-card/40 border-white/5">
                <CardHeader>
                    <CardTitle className="text-sm">Audit Trail</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-6 text-sm">
                        <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Created by:</span>
                            <span>{run.creator?.name || 'Unknown'}</span>
                            <span className="text-muted-foreground">
                                ({format(new Date(run.created_at), 'MMM d, h:mm a')})
                            </span>
                        </div>
                        {run.approved_by && (
                            <div className="flex items-center gap-2">
                                <CheckCircle className="h-4 w-4 text-blue-400" />
                                <span className="text-muted-foreground">Approved by:</span>
                                <span>{run.approver?.name || 'Unknown'}</span>
                                {run.approved_at && (
                                    <span className="text-muted-foreground">
                                        ({format(new Date(run.approved_at), 'MMM d, h:mm a')})
                                    </span>
                                )}
                            </div>
                        )}
                        {run.paid_by && (
                            <div className="flex items-center gap-2">
                                <DollarSign className="h-4 w-4 text-emerald-400" />
                                <span className="text-muted-foreground">Paid by:</span>
                                <span>{run.payer?.name || 'Unknown'}</span>
                                {run.paid_at && (
                                    <span className="text-muted-foreground">
                                        ({format(new Date(run.paid_at), 'MMM d, h:mm a')})
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                    {run.void_reason && (
                        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                            <p className="text-sm text-red-400">
                                <strong>Void Reason:</strong> {run.void_reason}
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Breakdown by Coach */}
            <Card className="bg-card/40 border-white/5">
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Breakdown by Coach</CardTitle>
                    {run.status === 'draft' && (
                        <AddAdjustmentDialog
                            runId={runId}
                            onSuccess={async () => {
                                const statsData = await getPayrollStats(new Date(), new Date(), { payrollRunId: runId })
                                setStats(statsData)
                            }}
                        />
                    )}
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {Object.entries(stats.summary.byUser).map(([userId, user]) => (
                            <div
                                key={userId}
                                className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/5"
                            >
                                <div>
                                    <p className="font-medium">{user.name}</p>
                                    <p className="text-xs text-muted-foreground">{user.email}</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-emerald-400">
                                        {formatCurrency(user.total)}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {user.deals} deals
                                        {user.adjustments !== 0 && (
                                            <span className={user.adjustments >= 0 ? "text-blue-400" : "text-red-400"}>
                                                {' '}• {user.adjustments >= 0 ? '+' : ''}{formatCurrency(user.adjustments)} adj
                                            </span>
                                        )}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Commission Entries */}
            <Card className="bg-card/40 border-white/5">
                <CardHeader>
                    <CardTitle>Commission Entries</CardTitle>
                    <CardDescription>{stats.entries.length} entries in this run</CardDescription>
                </CardHeader>
                <CardContent>
                    <CommissionLedgerTable entries={stats.entries} showRecipient={true} />
                </CardContent>
            </Card>

            {/* Adjustments */}
            {stats.adjustments.length > 0 && (
                <AdjustmentsList runId={runId} />
            )}
        </div>
    )
}
