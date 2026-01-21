'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Calculator, Loader2, CheckCircle, XCircle, ExternalLink } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import Link from 'next/link';
import {
    getUncalculatedPayments,
    processUncalculatedCommissions,
    UncalculatedPayment
} from '@/lib/actions/payroll';

interface ProcessResult {
    processed: number;
    failed: number;
    skipped: number;
    errors: string[];
}

export function UncalculatedPaymentsAlert() {
    const [payments, setPayments] = useState<UncalculatedPayment[]>([]);
    const [orphanCount, setOrphanCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [result, setResult] = useState<ProcessResult | null>(null);

    useEffect(() => {
        loadPayments();
    }, []);

    async function loadPayments() {
        setLoading(true);
        try {
            const data = await getUncalculatedPayments();
            if (data.error) {
                console.error('Failed to load uncalculated payments:', data.error);
                return;
            }
            setPayments(data.payments);
            setOrphanCount(data.orphanCount);
        } catch (error) {
            console.error('Error loading uncalculated payments:', error);
        } finally {
            setLoading(false);
        }
    }

    async function handleProcessAll() {
        setProcessing(true);
        setResult(null);
        try {
            const res = await processUncalculatedCommissions();
            setResult(res);

            if (res.processed > 0) {
                toast.success(`Successfully calculated ${res.processed} commission(s)`);
            }
            if (res.failed > 0) {
                toast.error(`${res.failed} payment(s) failed to process`);
            }

            // Reload to update the list
            await loadPayments();
        } catch (error) {
            toast.error('Failed to process commissions');
            console.error('Error processing commissions:', error);
        } finally {
            setProcessing(false);
        }
    }

    // Don't show if no uncalculated payments and no orphans
    if (!loading && payments.length === 0 && orphanCount === 0) {
        return null;
    }

    // Database stores amounts in dollars (stripe-sync.ts converts from cents)
    const totalAmount = payments.reduce((sum, p) => sum + Number(p.amount), 0);

    return (
        <Card className="bg-yellow-500/10 border-yellow-500/30">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-yellow-500">
                    <AlertTriangle className="h-5 w-5" />
                    Payments Need Commission Calculation
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {loading ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Checking for uncalculated payments...
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                                <p className="text-muted-foreground">Ready to Process</p>
                                <p className="text-xl font-semibold text-yellow-500">{payments.length}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground">Total Amount</p>
                                <p className="text-xl font-semibold">{formatCurrency(totalAmount)}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground">Orphan Payments</p>
                                <p className="text-xl font-semibold text-orange-500">{orphanCount}</p>
                            </div>
                            {result && (
                                <div>
                                    <p className="text-muted-foreground">Last Run</p>
                                    <div className="flex items-center gap-2">
                                        {result.processed > 0 && (
                                            <Badge variant="default" className="bg-emerald-600">
                                                <CheckCircle className="h-3 w-3 mr-1" />
                                                {result.processed}
                                            </Badge>
                                        )}
                                        {result.failed > 0 && (
                                            <Badge variant="destructive">
                                                <XCircle className="h-3 w-3 mr-1" />
                                                {result.failed}
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {payments.length > 0 && (
                            <div className="max-h-[200px] overflow-y-auto space-y-2">
                                {payments.slice(0, 5).map(payment => (
                                    <div
                                        key={payment.id}
                                        className="flex items-center justify-between p-2 bg-card/50 rounded-md text-sm"
                                    >
                                        <div>
                                            <span className="font-medium">{payment.client_name || 'Unknown Client'}</span>
                                            <span className="text-muted-foreground ml-2">
                                                {new Date(payment.payment_date).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <span className="font-semibold">{formatCurrency(payment.amount)}</span>
                                    </div>
                                ))}
                                {payments.length > 5 && (
                                    <p className="text-xs text-muted-foreground text-center">
                                        +{payments.length - 5} more payments
                                    </p>
                                )}
                            </div>
                        )}

                        {result?.errors && result.errors.length > 0 && (
                            <div className="text-xs text-red-400 bg-red-500/10 p-2 rounded">
                                <p className="font-medium mb-1">Errors:</p>
                                {result.errors.slice(0, 3).map((err, i) => (
                                    <p key={i} className="truncate">{err}</p>
                                ))}
                            </div>
                        )}

                        <div className="flex gap-2">
                            <Button
                                onClick={handleProcessAll}
                                disabled={processing || payments.length === 0}
                                className="bg-yellow-600 hover:bg-yellow-500 text-white"
                            >
                                {processing ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <Calculator className="mr-2 h-4 w-4" />
                                        Calculate All ({payments.length})
                                    </>
                                )}
                            </Button>
                            <Button
                                variant="outline"
                                onClick={loadPayments}
                                disabled={loading || processing}
                                className="border-white/10"
                            >
                                Refresh
                            </Button>
                        </div>

                        {orphanCount > 0 && (
                            <div className="flex items-center justify-between">
                                <p className="text-xs text-orange-400">
                                    Note: {orphanCount} payment(s) have no linked client and require manual matching.
                                </p>
                                <Link href="/commissions/orphan-payments">
                                    <Button variant="outline" size="sm" className="border-orange-500/30 text-orange-400 hover:bg-orange-500/10">
                                        <ExternalLink className="mr-2 h-3 w-3" />
                                        Review Orphans
                                    </Button>
                                </Link>
                            </div>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
}
