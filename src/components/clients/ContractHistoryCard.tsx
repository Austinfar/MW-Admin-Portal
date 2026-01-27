'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    FileText,
    Calendar,
    CheckCircle2,
    Clock,
    XCircle,
    Plus,
    RefreshCw,
    ChevronDown,
    ChevronUp,
    ExternalLink,
    Loader2,
} from 'lucide-react'
import { format, differenceInDays, parseISO } from 'date-fns'
import { getClientContracts } from '@/lib/actions/contracts'
import type { ClientContractWithAgreement, ContractStatus, PaymentType } from '@/types/contract'

interface ContractHistoryCardProps {
    clientId: string
    onCreateContract?: () => void
    onRenewContract?: (contractId: string) => void
    refreshTrigger?: number // Increment this to trigger a refresh
}

const STATUS_CONFIG: Record<ContractStatus, { label: string; color: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ElementType }> = {
    active: { label: 'Active', color: 'default', icon: CheckCircle2 },
    completed: { label: 'Completed', color: 'secondary', icon: Clock },
    cancelled: { label: 'Cancelled', color: 'destructive', icon: XCircle },
}

const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
    paid_in_full: 'Paid in Full',
    split_pay: 'Split Payment',
    monthly: 'Monthly',
}

export function ContractHistoryCard({
    clientId,
    onCreateContract,
    onRenewContract,
    refreshTrigger = 0,
}: ContractHistoryCardProps) {
    const [contracts, setContracts] = useState<ClientContractWithAgreement[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [expanded, setExpanded] = useState(false)

    useEffect(() => {
        loadContracts()
    }, [clientId, refreshTrigger])

    async function loadContracts() {
        setIsLoading(true)
        const data = await getClientContracts(clientId)
        setContracts(data)
        setIsLoading(false)
    }

    // Get the active contract (if any)
    const activeContract = contracts.find(c => c.status === 'active')
    const hasExpiredContract = activeContract && differenceInDays(parseISO(activeContract.end_date), new Date()) < 0

    // Show only first contract when collapsed, all when expanded
    const displayContracts = expanded ? contracts : contracts.slice(0, 1)

    if (isLoading) {
        return (
            <Card className="bg-card/50 backdrop-blur-xl border-white/5 hover:border-primary/20 transition-all duration-300 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <div className="p-2 rounded-full bg-blue-500/10 shrink-0">
                            <FileText className="h-4 w-4 text-blue-500" />
                        </div>
                        Contract History
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="bg-card/50 backdrop-blur-xl border-white/5 hover:border-primary/20 transition-all duration-300 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]">
            <CardHeader className="space-y-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <div className="p-2 rounded-full bg-blue-500/10 shrink-0">
                            <FileText className="h-4 w-4 text-blue-500" />
                        </div>
                        Contract History
                    </CardTitle>
                    {contracts.length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                            {contracts.length} {contracts.length === 1 ? 'contract' : 'contracts'}
                        </Badge>
                    )}
                </div>
                <CardDescription className="text-xs">
                    Track contract periods and renewals
                </CardDescription>

                {/* Action buttons */}
                <div className="flex gap-2">
                    {!activeContract && onCreateContract && (
                        <Button
                            onClick={onCreateContract}
                            size="sm"
                            className="flex-1"
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            Add Contract
                        </Button>
                    )}
                    {activeContract && hasExpiredContract && onRenewContract && (
                        <Button
                            onClick={() => onRenewContract(activeContract.id)}
                            size="sm"
                            className="flex-1"
                        >
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Renew Contract
                        </Button>
                    )}
                </div>
            </CardHeader>

            <CardContent>
                {contracts.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
                        <p>No contracts found</p>
                        <p className="text-sm mt-1">Create a contract to track this client's program</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {displayContracts.map((contract) => (
                            <ContractItem
                                key={contract.id}
                                contract={contract}
                                onRenew={onRenewContract}
                            />
                        ))}

                        {/* Show more/less toggle */}
                        {contracts.length > 1 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setExpanded(!expanded)}
                                className="w-full text-muted-foreground"
                            >
                                {expanded ? (
                                    <>
                                        <ChevronUp className="mr-2 h-4 w-4" />
                                        Show Less
                                    </>
                                ) : (
                                    <>
                                        <ChevronDown className="mr-2 h-4 w-4" />
                                        Show All ({contracts.length - 1} more)
                                    </>
                                )}
                            </Button>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

interface ContractItemProps {
    contract: ClientContractWithAgreement
    onRenew?: (contractId: string) => void
}

function ContractItem({ contract, onRenew }: ContractItemProps) {
    const statusConfig = STATUS_CONFIG[contract.status]
    const StatusIcon = statusConfig.icon

    const daysUntilEnd = differenceInDays(parseISO(contract.end_date), new Date())
    const isExpiringSoon = contract.status === 'active' && daysUntilEnd <= 30 && daysUntilEnd > 0
    const isExpired = contract.status === 'active' && daysUntilEnd < 0

    const formatCurrency = (amount: number | null) => {
        if (amount === null) return '-'
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
        }).format(amount)
    }

    return (
        <div className="rounded-lg border border-white/10 p-3 space-y-3">
            {/* Header row */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Badge variant={statusConfig.color} className="gap-1 text-xs">
                        <StatusIcon className="h-3 w-3" />
                        {statusConfig.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                        Contract #{contract.contract_number}
                    </span>
                </div>
                {isExpiringSoon && (
                    <Badge variant="outline" className="text-xs text-amber-500 border-amber-500/50">
                        {daysUntilEnd}d left
                    </Badge>
                )}
                {isExpired && (
                    <Badge variant="destructive" className="text-xs">
                        Expired
                    </Badge>
                )}
            </div>

            {/* Program and dates */}
            <div className="space-y-1">
                <p className="text-sm font-medium">{contract.program_name}</p>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>
                        {format(parseISO(contract.start_date), 'MMM d, yyyy')} →{' '}
                        {format(parseISO(contract.end_date), 'MMM d, yyyy')}
                    </span>
                    <span className="text-muted-foreground/50">
                        ({contract.program_term_months} mo)
                    </span>
                </div>
            </div>

            {/* Payment info */}
            {(contract.total_value || contract.payment_type) && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {contract.total_value && (
                        <span>Total: {formatCurrency(contract.total_value)}</span>
                    )}
                    {contract.payment_type && (
                        <span>{PAYMENT_TYPE_LABELS[contract.payment_type]}</span>
                    )}
                    {contract.monthly_rate && (
                        <span>{formatCurrency(contract.monthly_rate)}/mo</span>
                    )}
                </div>
            )}

            {/* Agreement status */}
            {contract.agreement && (
                <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">Agreement:</span>
                    <Badge
                        variant={contract.agreement.status === 'signed' ? 'default' : 'outline'}
                        className="text-xs capitalize"
                    >
                        {contract.agreement.status}
                    </Badge>
                    {contract.agreement.signed_at && (
                        <span className="text-muted-foreground">
                            {format(parseISO(contract.agreement.signed_at), 'MMM d, yyyy')}
                        </span>
                    )}
                </div>
            )}

            {/* Manual entry indicator */}
            {contract.manual_entry && (
                <div className="text-xs text-muted-foreground italic">
                    Manually entered
                    {contract.manual_notes && `: ${contract.manual_notes}`}
                </div>
            )}

            {/* Renew button for expired contracts */}
            {isExpired && onRenew && (
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onRenew(contract.id)}
                    className="w-full mt-2"
                >
                    <RefreshCw className="mr-2 h-3 w-3" />
                    Renew Contract
                </Button>
            )}
        </div>
    )
}
