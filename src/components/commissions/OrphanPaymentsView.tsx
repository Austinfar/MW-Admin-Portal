'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, AlertTriangle, RefreshCw, Filter } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { getOrphanPayments, OrphanPayment } from '@/lib/actions/payroll';
import { OrphanPaymentCard } from './OrphanPaymentCard';

export function OrphanPaymentsView() {
    const [payments, setPayments] = useState<OrphanPayment[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [showExcluded, setShowExcluded] = useState(false);

    useEffect(() => {
        loadPayments();
    }, []);

    async function loadPayments() {
        setLoading(true);
        try {
            const result = await getOrphanPayments();
            if (result.error) {
                console.error('Failed to load orphan payments:', result.error);
            } else {
                setPayments(result.payments);
            }
        } catch (error) {
            console.error('Error loading orphan payments:', error);
        } finally {
            setLoading(false);
        }
    }

    // Filter payments
    const filteredPayments = payments.filter(payment => {
        // Filter by excluded status
        if (!showExcluded && payment.review_status === 'excluded') {
            return false;
        }

        // Filter by search query
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return (
                payment.client_email?.toLowerCase().includes(query) ||
                payment.stripe_payment_id.toLowerCase().includes(query)
            );
        }

        return true;
    });

    // Calculate stats
    const totalAmount = filteredPayments.reduce((sum, p) => sum + p.amount, 0);
    const excludedCount = payments.filter(p => p.review_status === 'excluded').length;
    const pendingCount = payments.filter(p => p.review_status !== 'excluded').length;

    return (
        <div className="space-y-6">
            {/* Header Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-card/40 border-white/5 backdrop-blur-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-500">{pendingCount}</div>
                        <p className="text-xs text-muted-foreground">Unmatched payments</p>
                    </CardContent>
                </Card>

                <Card className="bg-card/40 border-white/5 backdrop-blur-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Total Value</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-500">
                            {formatCurrency(totalAmount)}
                        </div>
                        <p className="text-xs text-muted-foreground">In orphan payments</p>
                    </CardContent>
                </Card>

                <Card className="bg-card/40 border-white/5 backdrop-blur-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Excluded</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-gray-500">{excludedCount}</div>
                        <p className="text-xs text-muted-foreground">Manually excluded</p>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div className="flex gap-2 items-center">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by email, name, or ID..."
                            className="pl-8 w-[300px] bg-white/5 border-white/10"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <Button
                        variant={showExcluded ? 'default' : 'outline'}
                        size="sm"
                        className={showExcluded ? 'bg-gray-600' : 'border-white/10'}
                        onClick={() => setShowExcluded(!showExcluded)}
                    >
                        <Filter className="mr-2 h-4 w-4" />
                        {showExcluded ? 'Hiding Excluded' : 'Show Excluded'}
                    </Button>
                </div>

                <Button
                    variant="outline"
                    size="sm"
                    className="border-white/10"
                    onClick={loadPayments}
                    disabled={loading}
                >
                    <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            {/* Payment List */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : filteredPayments.length === 0 ? (
                <Card className="bg-card/40 border-white/5">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
                        <CardTitle className="text-lg mb-2">No Orphan Payments</CardTitle>
                        <CardDescription>
                            {searchQuery
                                ? 'No payments match your search criteria.'
                                : 'All payments have been matched to clients or excluded.'}
                        </CardDescription>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    {filteredPayments.map((payment) => (
                        <OrphanPaymentCard
                            key={payment.id}
                            payment={payment}
                            onMatched={loadPayments}
                        />
                    ))}
                </div>
            )}

            {/* Info Banner */}
            <Card className="bg-blue-500/10 border-blue-500/30">
                <CardContent className="py-4">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-blue-400 mt-0.5" />
                        <div>
                            <p className="text-sm font-medium text-blue-400">About Orphan Payments</p>
                            <p className="text-sm text-muted-foreground mt-1">
                                Orphan payments are Stripe payments that couldn&apos;t be automatically matched to a client
                                in the system. This can happen when:
                            </p>
                            <ul className="text-sm text-muted-foreground mt-2 list-disc list-inside space-y-1">
                                <li>The customer email doesn&apos;t match any client record</li>
                                <li>The payment was made through a direct Stripe link</li>
                                <li>The client record was created after the payment</li>
                            </ul>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
