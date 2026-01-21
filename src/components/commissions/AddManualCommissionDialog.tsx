'use client';

import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, DollarSign, Plus } from 'lucide-react';
import {
    createManualCommission,
    getCoachesForManualCommission,
    getClientsForManualCommission,
    ManualCommissionPayload
} from '@/lib/actions/manual-commission';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
    preselectedCoachId?: string;
}

const CATEGORY_OPTIONS = [
    { value: 'sale', label: 'Sale', description: 'Commission from a new sale' },
    { value: 'renewal', label: 'Renewal', description: 'Commission from a client renewal' },
    { value: 'referral', label: 'Referral', description: 'Referral bonus' },
    { value: 'bonus', label: 'Bonus', description: 'Discretionary bonus' },
    { value: 'adjustment', label: 'Adjustment', description: 'Correction to previous entry' },
    { value: 'other', label: 'Other', description: 'Other commission type' },
];

const ROLE_OPTIONS = [
    { value: 'coach', label: 'Coach' },
    { value: 'closer', label: 'Closer' },
    { value: 'setter', label: 'Setter' },
    { value: 'referrer', label: 'Referrer' },
];

export function AddManualCommissionDialog({ open, onOpenChange, onSuccess, preselectedCoachId }: Props) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [coaches, setCoaches] = useState<Array<{ id: string; name: string | null; email: string | null }>>([]);
    const [clients, setClients] = useState<Array<{ id: string; name: string; email: string | null }>>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Form state
    const [coachId, setCoachId] = useState<string>(preselectedCoachId || '');
    const [clientId, setClientId] = useState<string>('');
    const [clientName, setClientName] = useState<string>('');
    const [grossAmount, setGrossAmount] = useState<string>('');
    const [commissionAmount, setCommissionAmount] = useState<string>('');
    const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [category, setCategory] = useState<ManualCommissionPayload['category']>('sale');
    const [role, setRole] = useState<'coach' | 'closer' | 'setter' | 'referrer'>('coach');
    const [notes, setNotes] = useState<string>('');

    // Load coaches and clients
    useEffect(() => {
        if (open) {
            setIsLoading(true);
            Promise.all([
                getCoachesForManualCommission(),
                getClientsForManualCommission()
            ]).then(([coachData, clientData]) => {
                setCoaches(coachData);
                setClients(clientData);
                setIsLoading(false);
            });

            // Reset form
            setCoachId(preselectedCoachId || '');
            setClientId('');
            setClientName('');
            setGrossAmount('');
            setCommissionAmount('');
            setDate(new Date().toISOString().split('T')[0]);
            setCategory('sale');
            setRole('coach');
            setNotes('');
        }
    }, [open, preselectedCoachId]);

    // Auto-calculate commission from gross when gross changes
    const handleGrossChange = (value: string) => {
        setGrossAmount(value);
        // If commission is empty or matches previous calculation, auto-update
        const gross = parseFloat(value.replace(/[$,]/g, ''));
        if (!isNaN(gross)) {
            // Default to 50% for coaches
            const defaultRate = role === 'coach' ? 0.5 : 0.1;
            const suggested = gross * defaultRate;
            // Only auto-fill if commission is empty
            if (!commissionAmount) {
                setCommissionAmount(suggested.toFixed(2));
            }
        }
    };

    const handleSubmit = async () => {
        if (!coachId) {
            toast.error('Please select a coach');
            return;
        }

        const commission = parseFloat(commissionAmount.replace(/[$,]/g, ''));
        if (isNaN(commission) || commission <= 0) {
            toast.error('Please enter a valid commission amount');
            return;
        }

        if (!notes.trim()) {
            toast.error('Please add notes explaining this commission');
            return;
        }

        setIsSubmitting(true);

        try {
            const gross = parseFloat(grossAmount.replace(/[$,]/g, '')) || 0;

            const result = await createManualCommission({
                coachId,
                clientId: clientId || undefined,
                clientName: clientName || undefined,
                grossAmount: gross,
                commissionAmount: commission,
                date,
                category,
                role,
                notes: notes.trim(),
            });

            if (result.error) {
                toast.error(result.error);
            } else {
                toast.success('Manual commission created');
                onOpenChange(false);
                onSuccess?.();
            }
        } catch (e) {
            toast.error('Failed to create commission');
        } finally {
            setIsSubmitting(false);
        }
    };

    const parsedGross = parseFloat(grossAmount.replace(/[$,]/g, '')) || 0;
    const parsedCommission = parseFloat(commissionAmount.replace(/[$,]/g, '')) || 0;
    const effectiveRate = parsedGross > 0 ? (parsedCommission / parsedGross * 100).toFixed(1) : '0';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] bg-[#0a0a0a] border-white/10">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Plus className="h-5 w-5 text-emerald-500" />
                        Add Manual Commission
                    </DialogTitle>
                    <DialogDescription>
                        Create a commission entry for payments outside of Stripe or special circumstances.
                    </DialogDescription>
                </DialogHeader>

                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <div className="space-y-4 py-4">
                        {/* Coach Selection */}
                        <div className="space-y-2">
                            <Label>Recipient *</Label>
                            <select
                                value={coachId}
                                onChange={(e) => setCoachId(e.target.value)}
                                className="w-full h-10 px-3 py-2 bg-[#1a1a1a] border border-white/10 rounded-md text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                            >
                                <option value="">Select recipient...</option>
                                {coaches.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name || c.email || 'Unknown'}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Role */}
                        <div className="space-y-2">
                            <Label>Role</Label>
                            <select
                                value={role}
                                onChange={(e) => setRole(e.target.value as typeof role)}
                                className="w-full h-10 px-3 py-2 bg-[#1a1a1a] border border-white/10 rounded-md text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                            >
                                {ROLE_OPTIONS.map((r) => (
                                    <option key={r.value} value={r.value}>
                                        {r.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Client Selection (Optional) */}
                        <div className="space-y-2">
                            <Label>Related Client (Optional)</Label>
                            <select
                                value={clientId}
                                onChange={(e) => {
                                    setClientId(e.target.value);
                                    if (e.target.value) setClientName('');
                                }}
                                className="w-full h-10 px-3 py-2 bg-[#1a1a1a] border border-white/10 rounded-md text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                            >
                                <option value="">No client linked</option>
                                {clients.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name} ({c.email})
                                    </option>
                                ))}
                            </select>
                            {!clientId && (
                                <Input
                                    placeholder="Or type client name (if not in system)"
                                    value={clientName}
                                    onChange={(e) => setClientName(e.target.value)}
                                    className="bg-[#1a1a1a] border-white/10"
                                />
                            )}
                        </div>

                        {/* Amounts */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Gross Amount</Label>
                                <div className="relative">
                                    <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        type="text"
                                        placeholder="0.00"
                                        value={grossAmount}
                                        onChange={(e) => handleGrossChange(e.target.value)}
                                        className="pl-8 bg-[#1a1a1a] border-white/10"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Commission Amount *</Label>
                                <div className="relative">
                                    <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        type="text"
                                        placeholder="0.00"
                                        value={commissionAmount}
                                        onChange={(e) => setCommissionAmount(e.target.value)}
                                        className="pl-8 bg-[#1a1a1a] border-white/10"
                                    />
                                </div>
                                {parsedGross > 0 && (
                                    <p className="text-xs text-muted-foreground">
                                        Effective rate: {effectiveRate}%
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Date and Category */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Date</Label>
                                <Input
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="bg-[#1a1a1a] border-white/10"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Category *</Label>
                                <select
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value as ManualCommissionPayload['category'])}
                                    className="w-full h-10 px-3 py-2 bg-[#1a1a1a] border border-white/10 rounded-md text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                                >
                                    {CATEGORY_OPTIONS.map((c) => (
                                        <option key={c.value} value={c.value}>
                                            {c.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Notes */}
                        <div className="space-y-2">
                            <Label>Notes * (Required for audit trail)</Label>
                            <Textarea
                                placeholder="Explain why this commission is being added manually..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className="bg-[#1a1a1a] border-white/10 min-h-[80px]"
                            />
                        </div>

                        {/* Summary */}
                        {parsedCommission > 0 && (
                            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-muted-foreground">Commission to be added:</span>
                                    <span className="text-xl font-bold text-emerald-400">
                                        {formatCurrency(parsedCommission)}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        className="bg-white/5 border-white/10"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isSubmitting || isLoading || !coachId || !commissionAmount || !notes.trim()}
                        className="bg-emerald-600 hover:bg-emerald-500"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Creating...
                            </>
                        ) : (
                            <>
                                <Plus className="mr-2 h-4 w-4" />
                                Add Commission
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
