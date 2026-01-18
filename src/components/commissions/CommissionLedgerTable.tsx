import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PayrollLedgerEntry } from '@/lib/actions/payroll';
import { formatCurrency, cn } from '@/lib/utils';
import { format } from 'date-fns';

interface CommissionLedgerTableProps {
    entries: PayrollLedgerEntry[];
}

export function CommissionLedgerTable({ entries }: CommissionLedgerTableProps) {
    return (
        <Table>
            <TableHeader>
                <TableRow className="hover:bg-white/5 border-white/10">
                    <TableHead>Transaction Date</TableHead>
                    <TableHead>Sale Date</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Closer</TableHead>
                    <TableHead>Gross</TableHead>
                    <TableHead>Basis (Net)</TableHead>
                    <TableHead>Rate</TableHead>
                    <TableHead className="text-right">Commission</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {entries.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={9} className="text-center h-24 text-muted-foreground">
                            No records found.
                        </TableCell>
                    </TableRow>
                ) : (
                    entries.map((entry) => {
                        const saleDate = entry.clients?.start_date ? format(new Date(entry.clients.start_date), 'MMM dd, yyyy') : '-';
                        return (
                            <TableRow key={entry.id} className="hover:bg-white/5 border-white/10">
                                <TableCell>{format(new Date(entry.created_at), 'MMM dd, yyyy')}</TableCell>
                                <TableCell className="text-muted-foreground">{saleDate}</TableCell>
                                <TableCell>{entry.clients?.name || 'Unknown'}</TableCell>
                                <TableCell>{entry.users?.name || 'Unknown'}</TableCell>
                                <TableCell>{formatCurrency(Number(entry.gross_amount))}</TableCell>
                                <TableCell>{formatCurrency(Number(entry.net_amount))}</TableCell>
                                <TableCell>
                                    {entry.calculation_basis && (entry.calculation_basis as any).rate ?
                                        `${((entry.calculation_basis as any).rate * 100).toFixed(0)}%` :
                                        '-'
                                    }
                                </TableCell>
                                <TableCell className="text-right font-medium text-emerald-500">
                                    {formatCurrency(Number(entry.commission_amount))}
                                </TableCell>
                                <TableCell className="text-right capitalize">
                                    <span className={cn(
                                        "px-2 py-1 rounded-full text-xs font-medium",
                                        entry.status === 'paid' ? "bg-emerald-500/10 text-emerald-500" :
                                            entry.status === 'pending' ? "bg-yellow-500/10 text-yellow-500" :
                                                "bg-red-500/10 text-red-500"
                                    )}>
                                        {entry.status}
                                    </span>
                                </TableCell>
                            </TableRow>
                        );
                    })
                )}
            </TableBody>
        </Table>
    );
}
