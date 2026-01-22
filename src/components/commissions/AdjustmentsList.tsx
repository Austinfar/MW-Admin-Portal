'use client'

import { useState, useEffect } from 'react'
import { formatDistanceToNow, format } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Plus, Minus, RefreshCw, AlertTriangle, Gift, Info, Trash2 } from 'lucide-react'
import { getAdjustments, CommissionAdjustment, removeAdjustment } from '@/lib/actions/payroll'
import { formatCurrency, cn } from '@/lib/utils'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { toast } from 'sonner'
import { Button } from '../ui/button'

interface AdjustmentsListProps {
    userId?: string
    runId?: string
    limit?: number
    showTitle?: boolean
    className?: string
    adjustments?: CommissionAdjustment[] // Allow passing data directly
    onUpdate?: () => void
}

const TYPE_CONFIG: Record<string, { label: string; icon: typeof Plus; color: string; bgColor: string }> = {
    bonus: {
        label: 'Bonus',
        icon: Gift,
        color: 'text-emerald-400',
        bgColor: 'bg-emerald-500/20'
    },
    deduction: {
        label: 'Deduction',
        icon: Minus,
        color: 'text-red-400',
        bgColor: 'bg-red-500/20'
    },
    correction: {
        label: 'Correction',
        icon: RefreshCw,
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/20'
    },
    chargeback: {
        label: 'Chargeback',
        icon: AlertTriangle,
        color: 'text-orange-400',
        bgColor: 'bg-orange-500/20'
    },
    referral: {
        label: 'Referral',
        icon: Gift,
        color: 'text-purple-400',
        bgColor: 'bg-purple-500/20'
    }
}

export function AdjustmentsList({ userId, runId, limit, showTitle = true, className, adjustments: initialAdjustments, onUpdate }: AdjustmentsListProps) {
    const [adjustments, setAdjustments] = useState<CommissionAdjustment[]>(initialAdjustments || [])
    const [loading, setLoading] = useState(!initialAdjustments)
    const [deletingId, setDeletingId] = useState<string | null>(null)

    useEffect(() => {
        // If adjustments are passed directly, just update them when they change
        if (initialAdjustments) {
            setAdjustments(limit ? initialAdjustments.slice(0, limit) : initialAdjustments)
            setLoading(false)
            return
        }

        fetchAdjustments()
    }, [userId, runId, limit, initialAdjustments])

    async function fetchAdjustments() {
        setLoading(true)
        try {
            const data = await getAdjustments({ userId, runId })
            setAdjustments(limit ? data.slice(0, limit) : data)
        } catch (error) {
            console.error('Failed to fetch adjustments:', error)
        } finally {
            setLoading(false)
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('Are you sure you want to delete this adjustment?')) return

        setDeletingId(id)
        try {
            const result = await removeAdjustment(id)
            if (result.success) {
                toast.success('Adjustment removed')
                if (onUpdate) {
                    onUpdate()
                } else if (!initialAdjustments) {
                    fetchAdjustments()
                } else {
                    // Optimistic update if no parent refresh
                    setAdjustments(prev => prev.filter(a => a.id !== id))
                }
            } else {
                toast.error(result.error || 'Failed to remove')
            }
        } catch (e) {
            toast.error('Failed to remove adjustment')
        } finally {
            setDeletingId(null)
        }
    }

    if (loading) {
        return (
            <Card className={cn("bg-card/40 border-white/5 backdrop-blur-sm", className)}>
                {showTitle && (
                    <CardHeader>
                        <CardTitle className="text-lg">Adjustments</CardTitle>
                    </CardHeader>
                )}
                <CardContent className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </CardContent>
            </Card>
        )
    }

    if (adjustments.length === 0) {
        return (
            <Card className={cn("bg-card/40 border-white/5 backdrop-blur-sm", className)}>
                {showTitle && (
                    <CardHeader>
                        <CardTitle className="text-lg">Adjustments</CardTitle>
                    </CardHeader>
                )}
                <CardContent className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <Info className="h-8 w-8 mb-2 opacity-50" />
                    <p className="text-sm">No adjustments found</p>
                </CardContent>
            </Card>
        )
    }

    const total = adjustments.reduce((sum, a) => sum + Number(a.amount), 0)

    return (
        <Card className={cn("bg-card/40 border-white/5 backdrop-blur-sm", className)}>
            {showTitle && (
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg">Adjustments</CardTitle>
                    <div className={cn(
                        "text-sm font-medium",
                        total >= 0 ? "text-emerald-400" : "text-red-400"
                    )}>
                        Net: {total >= 0 ? '+' : ''}{formatCurrency(total)}
                    </div>
                </CardHeader>
            )}
            <CardContent className="space-y-3">
                {adjustments.map((adjustment) => {
                    const config = TYPE_CONFIG[adjustment.adjustment_type] || TYPE_CONFIG.deduction
                    const Icon = config.icon
                    const isPositive = adjustment.amount >= 0
                    const isDeleting = deletingId === adjustment.id

                    return (
                        <div
                            key={adjustment.id}
                            className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors border border-white/5 group relative"
                        >
                            <div className={cn("p-2 rounded-lg", config.bgColor)}>
                                <Icon className={cn("h-4 w-4", config.color)} />
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className={cn("text-xs", config.color, "border-current/30")}>
                                        {config.label}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                        {formatDistanceToNow(new Date(adjustment.created_at), { addSuffix: true })}
                                    </span>
                                </div>

                                <p className="text-sm mt-1 text-gray-300 line-clamp-2">
                                    {adjustment.reason}
                                </p>

                                {adjustment.notes && (
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <p className="text-xs text-muted-foreground mt-1 truncate cursor-help">
                                                    Note: {adjustment.notes}
                                                </p>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p className="max-w-xs">{adjustment.notes}</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                )}

                                {adjustment.users && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                        For: {adjustment.users.name}
                                    </p>
                                )}
                            </div>

                            <div className="flex flex-col items-end gap-2">
                                <div className={cn(
                                    "text-lg font-bold whitespace-nowrap",
                                    isPositive ? "text-emerald-400" : "text-red-400"
                                )}>
                                    {isPositive ? '+' : ''}{formatCurrency(adjustment.amount)}
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-muted-foreground hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => handleDelete(adjustment.id)}
                                    disabled={isDeleting}
                                >
                                    {isDeleting ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Trash2 className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>
                        </div>
                    )
                })}

                {limit && adjustments.length >= limit && (
                    <p className="text-xs text-center text-muted-foreground pt-2">
                        Showing {limit} most recent adjustments
                    </p>
                )}
            </CardContent>
        </Card>
    )
}
