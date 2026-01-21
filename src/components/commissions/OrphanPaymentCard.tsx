'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Search, Link2, Ban, Mail, Calendar, DollarSign } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import {
    OrphanPayment,
    ClientOption,
    searchClientsForMatch,
    matchOrphanPaymentToClient,
    excludeOrphanPayment
} from '@/lib/actions/payroll';

interface OrphanPaymentCardProps {
    payment: OrphanPayment;
    onMatched: () => void;
}

export function OrphanPaymentCard({ payment, onMatched }: OrphanPaymentCardProps) {
    const [isMatchDialogOpen, setIsMatchDialogOpen] = useState(false);
    const [isExcludeDialogOpen, setIsExcludeDialogOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState(payment.client_email || '');
    const [searchResults, setSearchResults] = useState<ClientOption[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedClient, setSelectedClient] = useState<ClientOption | null>(null);
    const [isMatching, setIsMatching] = useState(false);
    const [isExcluding, setIsExcluding] = useState(false);
    const [excludeReason, setExcludeReason] = useState('');

    // Debounced search
    useEffect(() => {
        const timeoutId = setTimeout(async () => {
            if (searchQuery.length >= 2) {
                setIsSearching(true);
                const result = await searchClientsForMatch(searchQuery);
                setSearchResults(result.clients);
                setIsSearching(false);
            } else {
                setSearchResults([]);
            }
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [searchQuery]);

    async function handleMatch() {
        if (!selectedClient) return;

        setIsMatching(true);
        try {
            const result = await matchOrphanPaymentToClient(payment.id, selectedClient.id);

            if (result.success) {
                toast.success(`Payment matched to ${selectedClient.name}`);
                setIsMatchDialogOpen(false);
                onMatched();
            } else {
                toast.error(result.error || 'Failed to match payment');
            }
        } catch (error) {
            toast.error('Failed to match payment');
        } finally {
            setIsMatching(false);
        }
    }

    async function handleExclude() {
        if (!excludeReason.trim()) {
            toast.error('Please provide a reason for exclusion');
            return;
        }

        setIsExcluding(true);
        try {
            const result = await excludeOrphanPayment(payment.id, excludeReason);

            if (result.success) {
                toast.success('Payment excluded from commission processing');
                setIsExcludeDialogOpen(false);
                onMatched();
            } else {
                toast.error(result.error || 'Failed to exclude payment');
            }
        } catch (error) {
            toast.error('Failed to exclude payment');
        } finally {
            setIsExcluding(false);
        }
    }

    const isExcluded = payment.review_status === 'excluded';

    return (
        <>
            <Card className={`bg-card/40 border-white/5 ${isExcluded ? 'opacity-50' : ''}`}>
                <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <DollarSign className="h-4 w-4 text-emerald-500" />
                                <span className="text-lg font-semibold text-emerald-500">
                                    {formatCurrency(payment.amount)}
                                </span>
                                {isExcluded && (
                                    <Badge variant="secondary" className="bg-gray-600">
                                        Excluded
                                    </Badge>
                                )}
                            </div>

                            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                                {payment.client_email && (
                                    <div className="flex items-center gap-1">
                                        <Mail className="h-3 w-3" />
                                        {payment.client_email}
                                    </div>
                                )}
                                <div className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {new Date(payment.payment_date).toLocaleDateString()}
                                </div>
                            </div>

                            <div className="text-xs text-muted-foreground/60 font-mono">
                                {payment.stripe_payment_id}
                            </div>
                        </div>

                        {!isExcluded && (
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="border-white/10"
                                    onClick={() => setIsMatchDialogOpen(true)}
                                >
                                    <Link2 className="mr-2 h-4 w-4" />
                                    Match to Client
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="border-white/10 text-orange-400 hover:text-orange-300"
                                    onClick={() => setIsExcludeDialogOpen(true)}
                                >
                                    <Ban className="mr-2 h-4 w-4" />
                                    Exclude
                                </Button>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Match Dialog */}
            <Dialog open={isMatchDialogOpen} onOpenChange={setIsMatchDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Match Payment to Client</DialogTitle>
                        <DialogDescription>
                            Search for a client to match this {formatCurrency(payment.amount)} payment to.
                            This will calculate commission based on the client&apos;s settings.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by name or email..."
                                className="pl-8"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        <div className="max-h-[300px] overflow-y-auto space-y-2">
                            {isSearching ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                </div>
                            ) : searchResults.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    {searchQuery.length >= 2
                                        ? 'No clients found'
                                        : 'Type at least 2 characters to search'}
                                </div>
                            ) : (
                                searchResults.map((client) => (
                                    <button
                                        key={client.id}
                                        className={`w-full p-3 rounded-lg text-left transition-colors ${
                                            selectedClient?.id === client.id
                                                ? 'bg-emerald-500/20 border border-emerald-500/50'
                                                : 'bg-white/5 hover:bg-white/10 border border-transparent'
                                        }`}
                                        onClick={() => setSelectedClient(client)}
                                    >
                                        <div className="font-medium">{client.name}</div>
                                        {client.email && (
                                            <div className="text-sm text-muted-foreground">{client.email}</div>
                                        )}
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setIsMatchDialogOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleMatch}
                            disabled={!selectedClient || isMatching}
                            className="bg-emerald-600 hover:bg-emerald-500"
                        >
                            {isMatching ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Matching...
                                </>
                            ) : (
                                <>
                                    <Link2 className="mr-2 h-4 w-4" />
                                    Match & Calculate
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Exclude Dialog */}
            <Dialog open={isExcludeDialogOpen} onOpenChange={setIsExcludeDialogOpen}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Exclude Payment</DialogTitle>
                        <DialogDescription>
                            This payment will be excluded from commission processing.
                            Please provide a reason for the exclusion.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4">
                        <Input
                            placeholder="Reason for exclusion..."
                            value={excludeReason}
                            onChange={(e) => setExcludeReason(e.target.value)}
                        />
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setIsExcludeDialogOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleExclude}
                            disabled={!excludeReason.trim() || isExcluding}
                        >
                            {isExcluding ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Excluding...
                                </>
                            ) : (
                                <>
                                    <Ban className="mr-2 h-4 w-4" />
                                    Exclude Payment
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
