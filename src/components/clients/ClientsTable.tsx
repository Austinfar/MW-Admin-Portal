'use client'

import { useState } from 'react'
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
import { MoreHorizontal, Filter } from 'lucide-react'
import { Client, ClientType } from '@/types/client'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { AddClientDialog } from './AddClientDialog'

interface ClientsTableProps {
    data: Client[]
    clientTypes: ClientType[]
}

export function ClientsTable({ data, clientTypes }: ClientsTableProps) {
    const [searchTerm, setSearchTerm] = useState('')
    const router = useRouter()

    const filteredData = data.filter((client) =>
        client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.email.toLowerCase().includes(searchTerm.toLowerCase())
    )

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
                        className="max-w-sm bg-background border-border"
                    />
                    <Button variant="outline" size="icon">
                        <Filter className="h-4 w-4" />
                    </Button>
                </div>
                <AddClientDialog clientTypes={clientTypes} />
            </div>

            <div className="rounded-md border bg-card/40 border-primary/5 shadow-sm">
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
                                            <span className="font-medium text-card-foreground">{client.name}</span>
                                            <span className="text-xs text-muted-foreground">{client.email}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="secondary" className={getStatusColor(client.status)}>
                                            {client.status.toUpperCase()}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {client.client_type?.name || <span className="text-gray-400 italic">Unassigned</span>}
                                    </TableCell>
                                    <TableCell>
                                        {client.assigned_coach?.name || <span className="text-gray-400 italic">Unassigned</span>}
                                    </TableCell>
                                    <TableCell>
                                        {format(new Date(client.start_date), 'MMM d, yyyy')}
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
                                                <DropdownMenuItem onClick={() => navigator.clipboard.writeText(client.id)}>
                                                    Copy ID
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem>View details</DropdownMenuItem>
                                                <DropdownMenuItem>View payments</DropdownMenuItem>
                                                <DropdownMenuItem className="text-red-600">Archive client</DropdownMenuItem>
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
