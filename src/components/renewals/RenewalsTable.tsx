'use client'

import { useState } from 'react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Card } from '@/components/ui/card'
import { ExternalLink, MoreHorizontal, MessageSquare, RefreshCw } from 'lucide-react'
import { updateRenewalStatus } from '@/lib/actions/renewals'
import { toast } from 'sonner'
import type { RenewalCalendarEvent, RenewalStatus } from '@/types/contract'

interface RenewalsTableProps {
    clients: RenewalCalendarEvent[]
}

const STATUS_CONFIG: Record<RenewalStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    pending: { label: 'Pending', variant: 'outline' },
    in_discussion: { label: 'In Discussion', variant: 'secondary' },
    renewed: { label: 'Renewed', variant: 'default' },
    churned: { label: 'Churned', variant: 'destructive' },
}

function getUrgencyBadge(days: number) {
    if (days < 0) {
        return <Badge variant="destructive">Expired {Math.abs(days)}d ago</Badge>
    }
    if (days <= 7) {
        return <Badge variant="destructive">{days}d left</Badge>
    }
    if (days <= 14) {
        return <Badge className="bg-orange-500 hover:bg-orange-600">{days}d left</Badge>
    }
    if (days <= 30) {
        return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-black">{days}d left</Badge>
    }
    return <Badge variant="secondary">{days}d left</Badge>
}

export function RenewalsTable({ clients }: RenewalsTableProps) {
    const [localClients, setLocalClients] = useState(clients)

    const handleStatusUpdate = async (clientId: string, newStatus: RenewalStatus) => {
        const result = await updateRenewalStatus(clientId, newStatus)

        if (result.success) {
            setLocalClients(prev =>
                prev.map(c =>
                    c.clientId === clientId ? { ...c, renewalStatus: newStatus } : c
                )
            )
            toast.success('Status updated')
        } else {
            toast.error(result.error || 'Failed to update status')
        }
    }

    if (clients.length === 0) {
        return (
            <Card className="p-8 text-center bg-card/50 backdrop-blur-xl border-white/5">
                <RefreshCw className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No contracts expiring in this timeframe.</p>
            </Card>
        )
    }

    return (
        <Card className="bg-card/50 backdrop-blur-xl border-white/5 overflow-hidden">
            <Table>
                <TableHeader>
                    <TableRow className="border-white/5 hover:bg-transparent">
                        <TableHead>Client</TableHead>
                        <TableHead>Program</TableHead>
                        <TableHead>Coach</TableHead>
                        <TableHead>End Date</TableHead>
                        <TableHead>Urgency</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {localClients.map((client) => {
                        const statusConfig = STATUS_CONFIG[client.renewalStatus]
                        return (
                            <TableRow
                                key={client.contractId}
                                className="border-white/5 hover:bg-white/5"
                            >
                                <TableCell>
                                    <Link
                                        href={`/clients/${client.clientId}`}
                                        className="font-medium hover:text-primary transition-colors flex items-center gap-1"
                                    >
                                        {client.clientName}
                                        <ExternalLink className="h-3 w-3 opacity-50" />
                                    </Link>
                                    <div className="text-xs text-muted-foreground">
                                        {client.clientEmail}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="font-medium">{client.programName}</div>
                                    <div className="text-xs text-muted-foreground">
                                        Contract #{client.contractNumber}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    {client.coachName || (
                                        <span className="text-muted-foreground italic">Unassigned</span>
                                    )}
                                </TableCell>
                                <TableCell>
                                    {format(parseISO(client.contractEndDate), 'MMM d, yyyy')}
                                </TableCell>
                                <TableCell>
                                    {getUrgencyBadge(client.daysUntilExpiration)}
                                </TableCell>
                                <TableCell>
                                    <Badge variant={statusConfig.variant}>
                                        {statusConfig.label}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem asChild>
                                                <Link href={`/clients/${client.clientId}`}>
                                                    <ExternalLink className="mr-2 h-4 w-4" />
                                                    View Client
                                                </Link>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={() => handleStatusUpdate(client.clientId, 'in_discussion')}
                                            >
                                                <MessageSquare className="mr-2 h-4 w-4" />
                                                Mark In Discussion
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={() => handleStatusUpdate(client.clientId, 'renewed')}
                                            >
                                                <RefreshCw className="mr-2 h-4 w-4" />
                                                Mark Renewed
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        )
                    })}
                </TableBody>
            </Table>
        </Card>
    )
}
