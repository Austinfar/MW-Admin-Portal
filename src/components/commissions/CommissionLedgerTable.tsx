import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PayrollLedgerEntry } from '@/lib/actions/payroll';
import { formatCurrency, cn } from '@/lib/utils';
import { format } from 'date-fns';

interface CommissionLedgerTableProps {
    entries: PayrollLedgerEntry[];
    showRecipient?: boolean; // Show recipient column (for admin view)
}

const ROLE_CONFIG: Record<string, { label: string; color: string }> = {
    coach: { label: 'Coach', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    closer: { label: 'Closer', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    setter: { label: 'Setter', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
    referrer: { label: 'Referrer', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' }
};

export function CommissionLedgerTable({ entries, showRecipient = true }: CommissionLedgerTableProps) {
    return (
        <Table>
            <TableHeader>
                <TableRow className="hover:bg-white/5 border-white/10">
                    <TableHead>Date</TableHead>
                    <TableHead>Client</TableHead>
                    {showRecipient && <TableHead>Recipient</TableHead>}
                    <TableHead>Role</TableHead>
                    <TableHead>Gross</TableHead>
                    <TableHead>Basis Amount</TableHead>
                    <TableHead>Rate</TableHead>
                    <TableHead className="text-right">Commission</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {entries.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={showRecipient ? 9 : 8} className="text-center h-24 text-muted-foreground">
                            No commission records found.
                        </TableCell>
                    </TableRow>
                ) : (
                    entries.map((entry) => {
                        const role = entry.split_role || 'coach';
                        const roleConfig = ROLE_CONFIG[role] || ROLE_CONFIG.coach;
                        const basis = (entry.calculation_basis as any);

                        // Determine rate display
                        let rateDisplay = '-';
                        if (entry.split_percentage) {
                            rateDisplay = `${entry.split_percentage.toFixed(0)}%`;
                        } else if (basis?.rate) {
                            rateDisplay = `${(basis.rate * 100).toFixed(0)}%`;
                        } else if (basis?.flat_fee) {
                            rateDisplay = 'Flat';
                        }

                        // Basis type indicator
                        const basisType = basis?.basis || 'net';

                        return (
                            <TableRow key={entry.id} className="hover:bg-white/5 border-white/10">
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span>{format(new Date(entry.transaction_date || entry.created_at), 'MMM dd, yyyy')}</span>
                                        <span className="text-xs text-muted-foreground">
                                            {format(new Date(entry.transaction_date || entry.created_at), 'h:mm a')}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span>{entry.clients?.name || (basis as any)?.client_name || 'Manual Entry'}</span>
                                        {entry.clients?.lead_source && (
                                            <span className="text-xs text-muted-foreground capitalize">
                                                {entry.clients.lead_source.replace('_', ' ')}
                                            </span>
                                        )}
                                        {!(entry.clients) && (basis as any)?.category && (
                                            <span className="text-xs text-muted-foreground capitalize">
                                                {(basis as any).category}
                                            </span>
                                        )}
                                    </div>
                                </TableCell>
                                {showRecipient && (
                                    <TableCell>{entry.users?.name || 'Unknown'}</TableCell>
                                )}
                                <TableCell>
                                    <Badge variant="outline" className={cn("text-xs", roleConfig.color)}>
                                        {roleConfig.label}
                                    </Badge>
                                </TableCell>
                                <TableCell>{formatCurrency(Number(entry.gross_amount))}</TableCell>
                                <TableCell>
                                    <div className="flex flex-col">
                                        {/* Show the actual basis amount used for calculation */}
                                        {basisType === 'gross' ? (
                                            // Closer/Setter: show gross amount
                                            <span>{formatCurrency(Number(entry.gross_amount))}</span>
                                        ) : basisType === 'remainder' ? (
                                            // Coach: show remainder after fees + other commissions
                                            <>
                                                <span>{formatCurrency(Number(entry.net_amount))}</span>
                                                <span className="text-xs text-muted-foreground">
                                                    after fees{basis?.other_commissions > 0 ? ' & splits' : ''}
                                                </span>
                                            </>
                                        ) : basisType === 'flat' ? (
                                            // Referrer: flat fee
                                            <span className="text-muted-foreground">-</span>
                                        ) : (
                                            // Fallback: show net_amount
                                            <>
                                                <span>{formatCurrency(Number(entry.net_amount))}</span>
                                                {basis?.stripe_fee && (
                                                    <span className="text-xs text-muted-foreground">
                                                        -{formatCurrency(basis.stripe_fee)} fee
                                                    </span>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span>{rateDisplay}</span>
                                        <span className="text-xs text-muted-foreground">
                                            {basisType === 'gross' ? 'on Gross' :
                                                basisType === 'remainder' ? 'on Remainder' :
                                                    basisType === 'flat' ? 'Flat Fee' :
                                                        basisType === 'net' ? 'on Net' : `on ${basisType}`}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-right font-medium text-emerald-500">
                                    {formatCurrency(Number(entry.commission_amount))}
                                </TableCell>
                                <TableCell className="text-right">
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
