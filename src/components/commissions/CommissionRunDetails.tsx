'use client';

import { useState, useEffect } from 'react';
import { PayrollRun, getPayrollStats, markPayrollPaid, PayrollStats, addAdjustment, removeAdjustment, getAllUsers } from '@/lib/actions/payroll';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CheckCircle, Download, Loader2, Plus, Trash2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, cn } from '@/lib/utils';
import { format } from 'date-fns';
import { CommissionLedgerTable } from './CommissionLedgerTable';

interface CommissionRunDetailsProps {
    run: PayrollRun;
    onBack: () => void;
}

export function CommissionRunDetails({ run, onBack }: CommissionRunDetailsProps) {
    const [stats, setStats] = useState<PayrollStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [users, setUsers] = useState<{ id: string, name: string }[]>([]);

    // Adjustment Form State
    const [isAdjustmentOpen, setIsAdjustmentOpen] = useState(false);
    const [adjType, setAdjType] = useState<'bonus' | 'clawback'>('bonus');
    const [adjUser, setAdjUser] = useState<string>('');
    const [adjAmount, setAdjAmount] = useState<string>('');
    const [adjReason, setAdjReason] = useState<string>('');

    async function fetchRunDetails() {
        setLoading(true);
        try {
            const [data, usersData] = await Promise.all([
                getPayrollStats(new Date(), new Date(), { payrollRunId: run.id }),
                getAllUsers()
            ]);
            setStats(data);
            // Sort users alphabetically
            const sortedUsers = (usersData || []).sort((a: any, b: any) =>
                (a.name || '').localeCompare(b.name || '')
            );
            setUsers(sortedUsers as any);
        } catch (error) {
            console.error('Failed to fetch run details', error);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchRunDetails();
    }, [run.id]);

    async function handleMarkAsPaid() {
        if (!confirm('Are you sure you want to finalize this payroll run? This will mark all transactions as PAID.')) return;

        setProcessing(true);
        try {
            await markPayrollPaid(run.id);
            alert('Payroll Marked as PAID!');
            onBack();
        } catch (e) {
            console.error(e);
            alert('Failed to update status');
            setProcessing(false);
        }
    }

    async function handleAddAdjustment() {
        if (!adjUser || !adjAmount || !adjReason) {
            alert('Please fill in all fields');
            return;
        }

        setProcessing(true);
        try {
            let amount = parseFloat(adjAmount);
            if (adjType === 'clawback') amount = -Math.abs(amount);
            else amount = Math.abs(amount);

            // Map UI type to API type
            const apiType = adjType === 'clawback' ? 'deduction' : 'bonus';
            await addAdjustment(adjUser, amount, apiType, adjReason, { runId: run.id });

            setIsAdjustmentOpen(false);
            setAdjUser('');
            setAdjAmount('');
            setAdjReason('');
            // Refresh data
            const data = await getPayrollStats(new Date(), new Date(), { payrollRunId: run.id });
            setStats(data);
        } catch (e) {
            console.error(e);
            alert('Failed to add adjustment');
        } finally {
            setProcessing(false);
        }
    }

    async function handleRemoveAdjustment(id: string) {
        if (!confirm('Are you sure?')) return;
        setProcessing(true);
        try {
            await removeAdjustment(id);
            const data = await getPayrollStats(new Date(), new Date(), { payrollRunId: run.id });
            setStats(data);
        } catch (e) {
            console.error(e);
            alert('Failed to removing adjustment');
        } finally {
            setProcessing(false);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" onClick={onBack}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back
                    </Button>
                    <div>
                        <h2 className="text-2xl font-bold">Payroll Run: {format(new Date(run.period_end), 'MMM dd, yyyy')}</h2>
                        <span className={cn(
                            "px-2 py-0.5 rounded-full text-xs font-medium uppercase",
                            run.status === 'paid' ? "bg-emerald-500/10 text-emerald-500" :
                                run.status === 'draft' ? "bg-yellow-500/10 text-yellow-500" :
                                    "bg-gray-500/10 text-gray-500"
                        )}>
                            {run.status}
                        </span>
                    </div>
                </div>

                <div className="flex gap-2">
                    <Button variant="outline" className="bg-white/5 border-white/10 hover:bg-white/10">
                        <Download className="mr-2 h-4 w-4" />
                        Export
                    </Button>

                    {run.status === 'draft' && (
                        <Button
                            className="bg-emerald-600 hover:bg-emerald-500 text-white"
                            onClick={handleMarkAsPaid}
                            disabled={processing}
                        >
                            {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                            Mark as Paid
                        </Button>
                    )}
                </div>
            </div>

            {stats && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card className="bg-card/40 border-white/5 backdrop-blur-sm">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium">Total Payout</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-emerald-500">{formatCurrency(stats.totalCommission)}</div>
                            </CardContent>
                        </Card>
                        <Card className="bg-card/40 border-white/5 backdrop-blur-sm">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium">Transactions</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats.entries.length}</div>
                            </CardContent>
                        </Card>
                        <Card className="bg-card/40 border-white/5 backdrop-blur-sm">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium">Adjustments</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats.adjustments?.length || 0}</div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Adjustments Section */}
                    <Card className="bg-card/40 border-white/5 backdrop-blur-sm">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Payroll Adjustments</CardTitle>
                            {run.status === 'draft' && (
                                <Dialog open={isAdjustmentOpen} onOpenChange={setIsAdjustmentOpen}>
                                    <DialogTrigger asChild>
                                        <Button size="sm" variant="outline" className="border-dashed">
                                            <Plus className="h-4 w-4 mr-2" />
                                            Add Adjustment
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>Add Adjustment</DialogTitle>
                                            <DialogDescription>
                                                Add a bonus or clawback to this payroll run.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="grid gap-4 py-4">
                                            <div className="grid gap-2">
                                                <Label>Type</Label>
                                                <Select value={adjType} onValueChange={(v: any) => setAdjType(v)}>
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="bonus">Bonus (+)</SelectItem>
                                                        <SelectItem value="clawback">Closer Clawback (-)</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="grid gap-2">
                                                <Label>Coach / User</Label>
                                                <Select value={adjUser} onValueChange={setAdjUser}>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select user..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {users.map(u => (
                                                            <SelectItem key={u.id} value={u.id}>{u.name || 'Unknown'}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="grid gap-2">
                                                <Label>Amount</Label>
                                                <Input
                                                    type="number"
                                                    placeholder="0.00"
                                                    value={adjAmount}
                                                    onChange={e => setAdjAmount(e.target.value)}
                                                />
                                            </div>
                                            <div className="grid gap-2">
                                                <Label>Reason</Label>
                                                <Input
                                                    placeholder="e.g. Monthly Bonus or Refund Clawback"
                                                    value={adjReason}
                                                    onChange={e => setAdjReason(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <DialogFooter>
                                            <Button onClick={handleAddAdjustment} disabled={processing}>Add Adjustment</Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            )}
                        </CardHeader>
                        <CardContent>
                            {(!stats.adjustments || stats.adjustments.length === 0) ? (
                                <div className="text-center py-6 text-muted-foreground text-sm">No adjustments for this run.</div>
                            ) : (
                                <div className="space-y-2">
                                    {stats.adjustments.map(adj => (
                                        <div key={adj.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
                                            <div>
                                                <div className="font-medium">{adj.users?.name || 'Unknown User'}</div>
                                                <div className="text-xs text-muted-foreground">{adj.reason}</div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <span className={cn(
                                                    "font-bold",
                                                    adj.amount >= 0 ? "text-emerald-500" : "text-rose-500"
                                                )}>
                                                    {formatCurrency(adj.amount)}
                                                </span>
                                                {run.status === 'draft' && (
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                        onClick={() => handleRemoveAdjustment(adj.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="bg-card/40 border-white/5 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle>Transactions</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <CommissionLedgerTable entries={stats.entries} />
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
