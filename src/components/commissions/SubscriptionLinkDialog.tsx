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
import { Label } from '@/components/ui/label';
import { Loader2, User, Users, DollarSign, Link2 } from 'lucide-react';
import { linkSubscriptionToClient } from '@/lib/actions/subscription-commission';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';

interface StripeSubscriptionWithConfig {
    id: string;
    status: string;
    customer: string;
    customer_email: string | null;
    customer_name: string | null;
    current_period_end: Date;
    cancel_at_period_end: boolean;
    plan_name: string;
    amount: number;
    currency: string;
    interval: string;
    created: Date;
    config?: {
        id: string;
        client_id: string | null;
        assigned_coach_id: string | null;
        lead_source: string | null;
        is_resign: boolean;
        commission_splits: any[] | null;
    } | null;
    client?: { id: string; name: string; email: string } | null;
}

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    subscription: StripeSubscriptionWithConfig;
    coaches: Array<{ id: string; name: string | null; avatar_url: string | null }>;
    closers: Array<{ id: string; name: string | null; avatar_url: string | null }>;
    clients: Array<{ id: string; name: string; email: string; stripe_customer_id: string | null }>;
    onSuccess: () => void;
}

export function SubscriptionLinkDialog({
    open,
    onOpenChange,
    subscription,
    coaches,
    closers,
    clients,
    onSuccess,
}: Props) {
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form state
    const [clientId, setClientId] = useState<string>('');
    const [coachId, setCoachId] = useState<string>('');
    const [leadSource, setLeadSource] = useState<'coach_driven' | 'company_driven'>('company_driven');
    const [isResign, setIsResign] = useState(false);

    // Commission splits (Closer/Referrer)
    const [closerId, setCloserId] = useState<string>('none');
    const [referrerId, setReferrerId] = useState<string>('none');

    // Auto-match client by email
    useEffect(() => {
        if (subscription.customer_email) {
            const matchedClient = clients.find(
                c => c.email?.toLowerCase() === subscription.customer_email?.toLowerCase()
            );
            if (matchedClient) {
                setClientId(matchedClient.id);
            }
        }

        // Pre-fill from existing config
        if (subscription.config) {
            if (subscription.config.client_id) setClientId(subscription.config.client_id);
            if (subscription.config.assigned_coach_id) setCoachId(subscription.config.assigned_coach_id);
            if (subscription.config.lead_source) setLeadSource(subscription.config.lead_source as 'coach_driven' | 'company_driven');
            if (subscription.config.is_resign) setIsResign(subscription.config.is_resign);

            // Extract splits
            const splits = subscription.config.commission_splits || [];
            const closer = splits.find((s: any) => s.role === 'Closer');
            const referrer = splits.find((s: any) => s.role === 'Referrer');
            if (closer?.userId) setCloserId(closer.userId);
            if (referrer?.userId) setReferrerId(referrer.userId);
        }
    }, [subscription, clients]);

    const handleSubmit = async () => {
        if (!clientId) {
            toast.error('Please select a client');
            return;
        }

        setIsSubmitting(true);

        try {
            // Build commission splits
            const commissionSplits: Array<{ userId: string; role: string; percentage?: number }> = [];
            if (closerId && closerId !== 'none') {
                commissionSplits.push({ userId: closerId, role: 'Closer', percentage: 10 });
            }
            if (referrerId && referrerId !== 'none') {
                commissionSplits.push({ userId: referrerId, role: 'Referrer' });
            }

            const result = await linkSubscriptionToClient(subscription.id, {
                clientId,
                coachId: coachId || undefined,
                commissionSplits: commissionSplits.length > 0 ? commissionSplits : undefined,
                leadSource,
                isResign,
            });

            if (result.error) {
                toast.error(result.error);
            } else {
                toast.success('Subscription linked successfully');
                onSuccess();
            }
        } catch (e) {
            toast.error('Failed to link subscription');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] bg-[#0a0a0a] border-white/10">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Link2 className="h-5 w-5 text-emerald-500" />
                        Link Subscription
                    </DialogTitle>
                    <DialogDescription>
                        Configure commission tracking for this Stripe subscription.
                    </DialogDescription>
                </DialogHeader>

                {/* Subscription Info */}
                <div className="bg-white/5 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Customer</span>
                        <span>{subscription.customer_email || 'No email'}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Plan</span>
                        <span>{subscription.plan_name}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Amount</span>
                        <span className="text-emerald-400">
                            {formatCurrency(subscription.amount)}/{subscription.interval}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Next Renewal</span>
                        <span>{format(new Date(subscription.current_period_end), 'MMM dd, yyyy')}</span>
                    </div>
                </div>

                <div className="space-y-4 py-4">
                    {/* Client Selection */}
                    <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            Link to Client
                        </Label>
                        <select
                            value={clientId}
                            onChange={(e) => setClientId(e.target.value)}
                            className="w-full h-10 px-3 py-2 bg-[#1a1a1a] border border-white/10 rounded-md text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                        >
                            <option value="">Select a client...</option>
                            {clients.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.name} ({c.email})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Coach Selection */}
                    <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            Assigned Coach
                        </Label>
                        <select
                            value={coachId}
                            onChange={(e) => setCoachId(e.target.value)}
                            className="w-full h-10 px-3 py-2 bg-[#1a1a1a] border border-white/10 rounded-md text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                        >
                            <option value="">Select a coach...</option>
                            {coaches.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.name || 'Unknown'}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Lead Source */}
                    <div className="space-y-2">
                        <Label>Lead Source</Label>
                        <select
                            value={leadSource}
                            onChange={(e) => setLeadSource(e.target.value as 'coach_driven' | 'company_driven')}
                            className="w-full h-10 px-3 py-2 bg-[#1a1a1a] border border-white/10 rounded-md text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                        >
                            <option value="company_driven">Company Driven (50%)</option>
                            <option value="coach_driven">Coach Driven (70%)</option>
                        </select>
                    </div>

                    {/* Is Resign */}
                    <div className="flex items-center space-x-2">
                        <input
                            type="checkbox"
                            id="isResign"
                            checked={isResign}
                            onChange={(e) => setIsResign(e.target.checked)}
                            className="h-4 w-4 rounded border-white/20 bg-white/5 text-emerald-500 focus:ring-emerald-500/50"
                        />
                        <Label htmlFor="isResign" className="font-normal cursor-pointer">
                            Re-signed Client (70% commission rate)
                        </Label>
                    </div>

                    {/* Commission Splits */}
                    <div className="border-t border-white/10 pt-4">
                        <Label className="flex items-center gap-2 mb-3">
                            <DollarSign className="h-4 w-4" />
                            Commission Splits (Optional)
                        </Label>

                        <div className="grid grid-cols-2 gap-4">
                            {/* Closer */}
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Sales Closer (10% Gross)</Label>
                                <select
                                    value={closerId}
                                    onChange={(e) => setCloserId(e.target.value)}
                                    className="w-full h-10 px-3 py-2 bg-[#1a1a1a] border border-white/10 rounded-md text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                                >
                                    <option value="none">No Closer</option>
                                    {closers.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.name || 'Unknown'}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Referrer */}
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Referrer ($100 First Payment)</Label>
                                <select
                                    value={referrerId}
                                    onChange={(e) => setReferrerId(e.target.value)}
                                    className="w-full h-10 px-3 py-2 bg-[#1a1a1a] border border-white/10 rounded-md text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                                >
                                    <option value="none">No Referrer</option>
                                    {closers.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.name || 'Unknown'}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

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
                        disabled={isSubmitting || !clientId}
                        className="bg-emerald-600 hover:bg-emerald-500"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Linking...
                            </>
                        ) : (
                            <>
                                <Link2 className="mr-2 h-4 w-4" />
                                Link Subscription
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
