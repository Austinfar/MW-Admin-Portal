'use client';

import { useState, useEffect } from 'react';
import { getPayrollHistory, PayrollRun } from '@/lib/actions/payroll';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { formatCurrency, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, Eye } from 'lucide-react';
import { CommissionRunDetails } from './CommissionRunDetails';

export function CommissionHistoryView() {
    const [history, setHistory] = useState<PayrollRun[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedRun, setSelectedRun] = useState<PayrollRun | null>(null);

    useEffect(() => {
        async function fetchHistory() {
            try {
                const data = await getPayrollHistory();
                setHistory(data);
            } catch (error) {
                console.error('Failed to fetch payroll history', error);
            } finally {
                setLoading(false);
            }
        }
        fetchHistory();
    }, [selectedRun]); // Re-fetch when closing detail view to update statuses

    if (selectedRun) {
        return (
            <CommissionRunDetails
                run={selectedRun}
                onBack={() => setSelectedRun(null)}
            />
        );
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <Card className="bg-card/40 border-white/5 backdrop-blur-sm">
            <CardHeader>
                <CardTitle>Payroll History</CardTitle>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-white/5 border-white/10">
                            <TableHead>Period Start</TableHead>
                            <TableHead>Period End</TableHead>
                            <TableHead>Payout Date</TableHead>
                            <TableHead>Total Amount</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {history.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                                    No payroll runs found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            history.map((run) => (
                                <TableRow key={run.id} className="hover:bg-white/5 border-white/10">
                                    <TableCell>{format(new Date(run.period_start), 'MMM dd, yyyy')}</TableCell>
                                    <TableCell>{format(new Date(run.period_end), 'MMM dd, yyyy')}</TableCell>
                                    <TableCell>{format(new Date(run.payout_date), 'MMM dd, yyyy')}</TableCell>
                                    <TableCell>{formatCurrency(run.total_amount)}</TableCell>
                                    <TableCell className="capitalize">
                                        <span className={cn(
                                            "px-2 py-1 rounded-full text-xs font-medium",
                                            run.status === 'paid' ? "bg-emerald-500/10 text-emerald-500" :
                                                run.status === 'draft' ? "bg-yellow-500/10 text-yellow-500" :
                                                    "bg-gray-500/10 text-gray-500"
                                        )}>
                                            {run.status}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="sm" onClick={() => setSelectedRun(run)}>
                                            <Eye className="h-4 w-4 mr-2" />
                                            View
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
