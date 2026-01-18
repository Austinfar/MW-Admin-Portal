'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getPayrollStats, PayrollStats, lockPayrollRun } from '@/lib/actions/payroll';
import { formatCurrency, cn } from '@/lib/utils';
import { Loader2, Calendar as CalendarIcon, Download, AlertCircle, Search, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DateRange } from 'react-day-picker';
import { startOfMonth, endOfMonth, format, isSameDay } from 'date-fns';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { CommissionLedgerTable } from './CommissionLedgerTable';
import { getPayrollPeriods, PayrollPeriod } from '@/lib/payroll-utils';

export function CommissionActiveView() {
    const [stats, setStats] = useState<PayrollStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [date, setDate] = useState<DateRange | undefined>({
        from: startOfMonth(new Date()),
        to: endOfMonth(new Date()),
    });

    // Payroll Period Logic
    const [periods, setPeriods] = useState<PayrollPeriod[]>([]);

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCoach, setSelectedCoach] = useState<string>('all');
    const [selectedClientType, setSelectedClientType] = useState<string>('all');
    const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [coaches, setCoaches] = useState<{ id: string, name: string | null }[]>([]);
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        setPeriods(getPayrollPeriods());

        async function checkAdminAndFetchCoaches() {
            try {
                const { getAllUsers, getCurrentUserProfile } = await import('@/lib/actions/profile');
                const profile = await getCurrentUserProfile();
                if (profile?.role === 'admin') {
                    setIsAdmin(true);
                    const { users } = await getAllUsers();
                    if (users) {
                        setCoaches(users.filter(u => u.role === 'coach' || u.role === 'sales_closer').map(u => ({ id: u.id, name: u.name })));
                    }
                }
            } catch (e) {
                console.error('Failed to init dashboard filters', e);
            }
        }
        checkAdminAndFetchCoaches();
    }, []);

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
        } catch (error) {
            console.error('Failed to export', error);
            alert('Failed to generate export');
        }
    }

    async function handleLockPayroll() {
        if (!date?.from || !date?.to) return;
        if (!confirm('Are you sure you want to lock this period? This will create a "Draft" payroll run containing all pending commissions in this date range.')) return;

        try {
            setLoading(true);
            // Calculate payout date: Next Friday after period end
            const periodEnd = new Date(date.to);
            const daysUntilFriday = (5 - periodEnd.getDay() + 7) % 7 || 7; // 5 is Friday
            const payoutDate = new Date(periodEnd);
            payoutDate.setDate(periodEnd.getDate() + daysUntilFriday);

            await lockPayrollRun(date.from, date.to, payoutDate);
            alert('Payroll Run Created! Check the History tab.');
            fetchStats(); // Refresh logic
        } catch (e) {
            console.error(e);
            alert('Failed to lock payroll');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                {/* Filters */}
                <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search client/coach..."
                            className="pl-8 w-[200px] bg-white/5 border-white/10"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    {isAdmin && (
                        <select
                            className="h-10 px-3 py-2 bg-[#1a1a1a] border border-white/10 rounded-md text-sm text-white focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
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
                        className="h-10 px-3 py-2 bg-[#1a1a1a] border border-white/10 rounded-md text-sm text-white focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
                        value={selectedClientType}
                        onChange={(e) => setSelectedClientType(e.target.value)}
                    >
                        <option value="all">All Sources</option>
                        <option value="company_driven">Company Driven</option>
                        <option value="self_gen">Self Generated</option>
                    </select>

                    <DateRangePicker
                        date={date}
                        setDate={setDate}
                        presets={periods.map(p => ({
                            label: p.label + (p.isCurrent ? ' (Current)' : ''),
                            date: { from: p.start, to: p.end }
                        }))}
                    />

                    <Button variant="outline" className="bg-white/5 border-white/10 hover:bg-white/10" onClick={handleExport}>
                        <Download className="mr-2 h-4 w-4" />
                        Export
                    </Button>

                    {isAdmin && (
                        <Button className="bg-yellow-500 text-black hover:bg-yellow-400" onClick={handleLockPayroll}>
                            <Lock className="mr-2 h-4 w-4" />
                            Lock Period
                        </Button>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center p-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : stats ? (
                <div className="space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card className="bg-card/40 border-white/5 backdrop-blur-sm">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Commission</CardTitle>
                                <div className="h-4 w-4 text-emerald-500 font-bold">$</div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-emerald-500">{formatCurrency(stats.totalCommission)}</div>
                                <p className="text-xs text-muted-foreground">Pending + Paid</p>
                            </CardContent>
                        </Card>
                        <Card className="bg-card/40 border-white/5 backdrop-blur-sm">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Pending Payout</CardTitle>
                                <div className="h-4 w-4 text-yellow-500">O</div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-yellow-500">
                                    {formatCurrency(stats.entries.filter(e => e.status === 'pending').reduce((sum, e) => sum + Number(e.commission_amount), 0))}
                                </div>
                                <p className="text-xs text-muted-foreground">Not yet paid out</p>
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="bg-card/40 border-white/5 backdrop-blur-sm">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle>Commission Ledger</CardTitle>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground mr-1">Sort by:</span>
                                    <button
                                        className={cn("text-xs px-2 py-1 rounded hover:bg-white/5", sortBy === 'date' && "bg-white/10 text-yellow-500")}
                                        onClick={() => { setSortBy('date'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}
                                    >
                                        Date {sortBy === 'date' && (sortOrder === 'asc' ? '↑' : '↓')}
                                    </button>
                                    <button
                                        className={cn("text-xs px-2 py-1 rounded hover:bg-white/5", sortBy === 'amount' && "bg-white/10 text-yellow-500")}
                                        onClick={() => { setSortBy('amount'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}
                                    >
                                        Amount {sortBy === 'amount' && (sortOrder === 'asc' ? '↑' : '↓')}
                                    </button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <CommissionLedgerTable entries={stats.entries} />
                        </CardContent>
                    </Card>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
                    <AlertCircle className="h-8 w-8 mb-2" />
                    <p>Failed to load data.</p>
                </div>
            )}
        </div>
    );
}
