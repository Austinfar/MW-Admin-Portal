'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getPayrollStats, PayrollStats, createPayrollDraft } from '@/lib/actions/payroll';
import { formatCurrency, cn } from '@/lib/utils';
import { Loader2, Download, AlertCircle, Search, FileText, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DateRange } from 'react-day-picker';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { CommissionLedgerTable } from './CommissionLedgerTable';
import { CoachCommissionSummary } from './CoachCommissionSummary';
import { PeriodSelector, PayPeriod, generatePayPeriods } from './PeriodSelector';
import { AdjustmentsList } from './AdjustmentsList';
import { AddManualCommissionDialog } from './AddManualCommissionDialog';
import { RecalculateCommissionDialog } from './RecalculateCommissionDialog';
import { UncalculatedPaymentsAlert } from './UncalculatedPaymentsAlert';
import { toast } from 'sonner';

export function CommissionActiveView() {
    const [stats, setStats] = useState<PayrollStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedPeriod, setSelectedPeriod] = useState<PayPeriod | null>(null);
    const [date, setDate] = useState<DateRange | undefined>(() => {
        const periods = generatePayPeriods(1);
        if (periods.length > 0) {
            return { from: periods[0].start, to: periods[0].end };
        }
        return { from: startOfMonth(new Date()), to: endOfMonth(new Date()) };
    });

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCoach, setSelectedCoach] = useState<string>('all');
    const [selectedClientType, setSelectedClientType] = useState<string>('all');
    const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [coaches, setCoaches] = useState<{ id: string, name: string | null }[]>([]);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isCreatingDraft, setIsCreatingDraft] = useState(false);
    const [isManualCommissionOpen, setIsManualCommissionOpen] = useState(false);
    const [isRecalculateOpen, setIsRecalculateOpen] = useState(false);

    // Initialize period and check admin
    useEffect(() => {
        const periods = generatePayPeriods(1);
        if (periods.length > 0) {
            setSelectedPeriod(periods[0]);
            setDate({ from: periods[0].start, to: periods[0].end });
        }

        async function checkAdminAndFetchCoaches() {
            try {
                const { getAllUsers, getCurrentUserProfile } = await import('@/lib/actions/profile');
                const profile = await getCurrentUserProfile();
                if (profile?.role === 'super_admin' || profile?.role === 'admin') {
                    setIsAdmin(true);
                    const { users } = await getAllUsers();
                    if (users) {
                        setCoaches(users.filter(u =>
                            u.job_title === 'coach' ||
                            u.job_title === 'head_coach' ||
                            u.job_title === 'closer'
                        ).map(u => ({ id: u.id, name: u.name })));
                    }
                }
            } catch (e) {
                console.error('Failed to init dashboard filters', e);
            }
        }
        checkAdminAndFetchCoaches();
    }, []);

    // Fetch stats when filters change
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            fetchStats();
        }, 300);
        return () => clearTimeout(timeoutId);
    }, [date, searchQuery, selectedCoach, selectedClientType, sortBy, sortOrder]);

    async function fetchStats() {
        if (!date?.from || !date?.to) return;
        setLoading(true);
        try {
            const filters = {
                coachId: selectedCoach === 'all' ? undefined : selectedCoach,
                clientType: selectedClientType === 'all' ? undefined : selectedClientType,
                searchQuery: searchQuery || undefined,
                sortBy,
                sortOrder
            };
            const data = await getPayrollStats(date.from, date.to, filters);
            setStats(data);
        } catch (error) {
            console.error('Failed to fetch payroll stats', error);
        } finally {
            setLoading(false);
        }
    }

    function handlePeriodChange(period: PayPeriod) {
        setSelectedPeriod(period);
        setDate({ from: period.start, to: period.end });
    }

    async function handleExport() {
        if (!date?.from || !date?.to) return;
        try {
            const { generatePayrollExport } = await import('@/lib/actions/payroll');
            const filters = {
                coachId: selectedCoach === 'all' ? undefined : selectedCoach,
                clientType: selectedClientType === 'all' ? undefined : selectedClientType,
                searchQuery: searchQuery || undefined,
                sortBy,
                sortOrder
            };
            const csvContent = await generatePayrollExport(date.from, date.to, filters);
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `commission_report_${format(date.from, 'yyyy-MM-dd')}_${format(date.to, 'yyyy-MM-dd')}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success('Export downloaded');
        } catch (error) {
            console.error('Failed to export', error);
            toast.error('Failed to generate export');
        }
    }

    async function handleCreateDraft() {
        if (!date?.from || !date?.to) return;

        // Calculate payout date: Next Friday after period end
        const periodEnd = new Date(date.to);
        const daysUntilFriday = (5 - periodEnd.getDay() + 7) % 7 || 7;
        const payoutDate = new Date(periodEnd);
        payoutDate.setDate(periodEnd.getDate() + daysUntilFriday);

        setIsCreatingDraft(true);
        try {
            const result = await createPayrollDraft(date.from, date.to, payoutDate);

            if (result.error) {
                toast.error(result.error);
                return;
            }

            toast.success('Payroll submitted for payment! Check the History tab.');
            fetchStats();
        } catch (e) {
            console.error(e);
            toast.error('Failed to create payroll draft');
        } finally {
            setIsCreatingDraft(false);
        }
    }

    // Calculate pending amount
    const pendingAmount = stats?.entries
        .filter(e => e.status === 'pending')
        .reduce((sum, e) => sum + Number(e.commission_amount), 0) || 0;

    return (
        <div className="space-y-6">
            {/* Summary Cards (for coaches) */}
            <CoachCommissionSummary />

            {/* Admin Alert: Uncalculated Payments */}
            {isAdmin && <UncalculatedPaymentsAlert />}

            {/* Filters Bar */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div className="flex flex-wrap gap-2 w-full lg:w-auto">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search client/coach..."
                            className="pl-8 w-[180px] bg-white/5 border-white/10"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    {isAdmin && (
                        <select
                            className="h-10 px-3 py-2 bg-[#1a1a1a] border border-white/10 rounded-md text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                            value={selectedCoach}
                            onChange={(e) => setSelectedCoach(e.target.value)}
                        >
                            <option value="all">All Coaches</option>
                            {coaches.map(c => (
                                <option key={c.id} value={c.id}>{c.name || 'Unknown'}</option>
                            ))}
                        </select>
                    )}

                    <select
                        className="h-10 px-3 py-2 bg-[#1a1a1a] border border-white/10 rounded-md text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                        value={selectedClientType}
                        onChange={(e) => setSelectedClientType(e.target.value)}
                    >
                        <option value="all">All Sources</option>
                        <option value="company_driven">Company Driven</option>
                        <option value="coach_driven">Coach Driven</option>
                    </select>

                    <PeriodSelector
                        selectedPeriod={selectedPeriod}
                        onPeriodChange={handlePeriodChange}
                    />
                </div>

                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        className="bg-white/5 border-white/10 hover:bg-white/10"
                        onClick={handleExport}
                    >
                        <Download className="mr-2 h-4 w-4" />
                        Export
                    </Button>

                    {isAdmin && (
                        <>
                            <Button
                                variant="outline"
                                className="bg-white/5 border-white/10 hover:bg-white/10"
                                onClick={() => setIsManualCommissionOpen(true)}
                            >
                                <Plus className="mr-2 h-4 w-4" />
                                Add Manual
                            </Button>
                            <Button
                                className="bg-emerald-600 text-white hover:bg-emerald-500"
                                onClick={handleCreateDraft}
                                disabled={isCreatingDraft}
                            >
                                {isCreatingDraft ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <FileText className="mr-2 h-4 w-4" />
                                )}
                                Submit for Payment
                            </Button>

                            <Button
                                variant="outline"
                                className="bg-amber-500/10 border-amber-500/20 text-amber-500 hover:bg-amber-500/20"
                                onClick={() => setIsRecalculateOpen(true)}
                                disabled={isCreatingDraft}
                            >
                                <AlertCircle className="mr-2 h-4 w-4" />
                                Recalculate Period
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center p-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : stats ? (
                <div className="space-y-6">
                    {/* Quick Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card className="bg-card/40 border-white/5 backdrop-blur-sm">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Period Total</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-emerald-500">
                                    {formatCurrency(stats.totalPayout)}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {stats.transactionCount} transactions
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="bg-card/40 border-white/5 backdrop-blur-sm">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Pending</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-yellow-500">
                                    {formatCurrency(pendingAmount)}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Awaiting payroll
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="bg-card/40 border-white/5 backdrop-blur-sm">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Top Earner</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-purple-500">
                                    {formatCurrency(stats.summary.topEarner.amount)}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {stats.summary.topEarner.name}
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Main Content Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Ledger Table */}
                        <Card className="lg:col-span-2 bg-card/40 border-white/5 backdrop-blur-sm">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle>Commission Ledger</CardTitle>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground mr-1">Sort:</span>
                                        <button
                                            className={cn(
                                                "text-xs px-2 py-1 rounded hover:bg-white/5",
                                                sortBy === 'date' && "bg-white/10 text-emerald-500"
                                            )}
                                            onClick={() => {
                                                setSortBy('date');
                                                setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                                            }}
                                        >
                                            Date {sortBy === 'date' && (sortOrder === 'asc' ? '↑' : '↓')}
                                        </button>
                                        <button
                                            className={cn(
                                                "text-xs px-2 py-1 rounded hover:bg-white/5",
                                                sortBy === 'amount' && "bg-white/10 text-emerald-500"
                                            )}
                                            onClick={() => {
                                                setSortBy('amount');
                                                setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                                            }}
                                        >
                                            Amount {sortBy === 'amount' && (sortOrder === 'asc' ? '↑' : '↓')}
                                        </button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <CommissionLedgerTable entries={stats.entries} showRecipient={isAdmin} />
                            </CardContent>
                        </Card>

                        {/* Adjustments Sidebar */}
                        <div className="space-y-6">
                            <div className="space-y-6">
                                <div className="space-y-6">
                                    <AdjustmentsList limit={5} adjustments={stats.adjustments} onUpdate={fetchStats} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
                    <AlertCircle className="h-8 w-8 mb-2" />
                    <p>Failed to load data.</p>
                </div>
            )}

            {/* Manual Commission Dialog */}
            <AddManualCommissionDialog
                open={isManualCommissionOpen}
                onOpenChange={setIsManualCommissionOpen}
                onSuccess={fetchStats}
            />

            {/* Recalculate Dialog */}
            <RecalculateCommissionDialog
                open={isRecalculateOpen}
                onOpenChange={setIsRecalculateOpen}
                period={selectedPeriod}
                onSuccess={fetchStats}
            />
        </div>
    );
}
