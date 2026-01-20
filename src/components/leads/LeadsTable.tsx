'use client'

import { useState } from 'react'
import Link from 'next/link'
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
import { Button } from "@/components/ui/button"
import { MoreHorizontal, ArrowRight, Trash } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { convertLeadToClient, deleteLead, updateLeadStatus } from "@/lib/actions/lead-actions"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface Lead {
    id: string
    first_name: string
    last_name: string | null
    email: string | null
    phone: string | null
    status: string
    source: string | null
    created_at: string
}

interface LeadsTableProps {
    initialLeads: Lead[]
}

export function LeadsTable({ initialLeads }: LeadsTableProps) {
    const [filter, setFilter] = useState('')

    // Simple client-side filtering
    const filteredLeads = initialLeads.filter(lead => {
        if (lead.status === 'converted') return false // Hide converted leads

        return (
            lead.first_name.toLowerCase().includes(filter.toLowerCase()) ||
            lead.last_name?.toLowerCase().includes(filter.toLowerCase()) ||
            lead.email?.toLowerCase().includes(filter.toLowerCase())
        )
    })

    const handleConvert = async (id: string) => {
        toast.promise(convertLeadToClient(id), {
            loading: 'Converting to client...',
            success: 'Lead converted successfully!',
            error: (err) => `Failed to convert: ${err}`
        })
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this lead?')) return
        toast.promise(deleteLead(id), {
            loading: 'Deleting...',
            success: 'Lead deleted',
            error: 'Failed to delete'
        })
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <Input
                    placeholder="Filter leads..."
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="max-w-sm bg-zinc-900/50 border-zinc-800"
                />
            </div>

            <div className="rounded-md border border-zinc-800 bg-zinc-900/50">
                <Table>
                    <TableHeader>
                        <TableRow className="border-zinc-800 hover:bg-zinc-800/50">
                            <TableHead className="text-zinc-400">Name</TableHead>
                            <TableHead className="text-zinc-400">Contact</TableHead>
                            <TableHead className="text-zinc-400">Status</TableHead>
                            <TableHead className="text-zinc-400">Source</TableHead>
                            <TableHead className="text-zinc-400 text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredLeads.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center text-zinc-500">
                                    No leads found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredLeads.map((lead) => (
                                <TableRow key={lead.id} className="border-zinc-800 hover:bg-zinc-800/50 group">
                                    <TableCell className="font-medium text-zinc-200">
                                        <Link href={`/leads/${lead.id}`} className="hover:text-neon-green hover:underline transition-colors block">
                                            {lead.first_name} {lead.last_name}
                                        </Link>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col text-sm text-zinc-400">
                                            <span>{lead.email || '-'}</span>
                                            <span className="text-xs text-zinc-500">{lead.phone}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <StatusBadge status={lead.status} />
                                    </TableCell>
                                    <TableCell className="text-zinc-400 capitalize">
                                        {lead.source || 'Manual'}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-8 w-8 p-0 text-zinc-400 hover:text-white">
                                                    <span className="sr-only">Open menu</span>
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800">
                                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                <DropdownMenuItem onClick={() => navigator.clipboard.writeText(lead.email || '')}>
                                                    Copy Email
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator className="bg-zinc-800" />
                                                <DropdownMenuItem
                                                    className="text-neon-green focus:text-neon-green focus:bg-neon-green/10"
                                                    onClick={() => handleConvert(lead.id)}
                                                >
                                                    <ArrowRight className="mr-2 h-4 w-4" />
                                                    Convert to Client
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    className="text-red-500 focus:text-red-500 focus:bg-red-500/10"
                                                    onClick={() => handleDelete(lead.id)}
                                                >
                                                    <Trash className="mr-2 h-4 w-4" />
                                                    Delete
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
    )
}

function StatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
        'New': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
        'Contacted': 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
        'Qualified': 'bg-purple-500/10 text-purple-500 border-purple-500/20',
        'Proposal': 'bg-pink-500/10 text-pink-500 border-pink-500/20',
        'Won': 'bg-neon-green/10 text-neon-green border-neon-green/20',
        'Lost': 'bg-red-500/10 text-red-500 border-red-500/20',
    }

    return (
        <span className={cn(
            "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
            styles[status] || styles['New']
        )}>
            {status}
        </span>
    )
}
