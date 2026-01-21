'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency, cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Search, Link2, LinkIcon, Unlink, RefreshCw, CheckCircle2 } from 'lucide-react';
import { SubscriptionLinkDialog } from './SubscriptionLinkDialog';
import { unlinkSubscription } from '@/lib/actions/subscription-commission';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

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
        coach?: { id: string; name: string } | null;
    } | null;
    client?: { id: string; name: string; email: string } | null;
}

interface Props {
    subscriptions: StripeSubscriptionWithConfig[];
    coaches: Array<{ id: string; name: string | null; avatar_url: string | null }>;
    closers: Array<{ id: string; name: string | null; avatar_url: string | null }>;
    clients: Array<{ id: string; name: string; email: string; stripe_customer_id: string | null }>;
}

export function SubscriptionsManagement({ subscriptions, coaches, closers, clients }: Props) {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedSubscription, setSelectedSubscription] = useState<StripeSubscriptionWithConfig | null>(null);
    const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
    const [isUnlinking, setIsUnlinking] = useState<string | null>(null);

    // Separate linked and unlinked
    const linked = subscriptions.filter(s => s.config && s.client);
    const unlinked = subscriptions.filter(s => !s.config || !s.client);

    // Filter by search
    const filterSubs = (subs: StripeSubscriptionWithConfig[]) => {
        if (!searchQuery) return subs;
        const q = searchQuery.toLowerCase();
        return subs.filter(s =>
            s.customer_email?.toLowerCase().includes(q) ||
            s.customer_name?.toLowerCase().includes(q) ||
            s.plan_name.toLowerCase().includes(q) ||
            s.client?.name?.toLowerCase().includes(q)
        );
    };

    const handleLink = (sub: StripeSubscriptionWithConfig) => {
        setSelectedSubscription(sub);
        setIsLinkDialogOpen(true);
    };

    const handleUnlink = async (subscriptionId: string) => {
        setIsUnlinking(subscriptionId);
        try {
            const result = await unlinkSubscription(subscriptionId);
            if (result.error) {
                toast.error(result.error);
            } else {
                toast.success('Subscription unlinked');
                router.refresh();
            }
        } catch (e) {
            toast.error('Failed to unlink subscription');
        } finally {
            setIsUnlinking(null);
        }
    };

    const handleLinkSuccess = () => {
        setIsLinkDialogOpen(false);
        setSelectedSubscription(null);
        router.refresh();
    };

    const SubscriptionRow = ({ sub, showLinkButton = false }: { sub: StripeSubscriptionWithConfig; showLinkButton?: boolean }) => (
        <TableRow className="hover:bg-white/5 border-white/10">
            <TableCell>
                <div className="flex flex-col">
                    <span className="font-medium">{sub.customer_email || 'No email'}</span>
                    <span className="text-xs text-muted-foreground">{sub.customer_name || 'Unknown'}</span>
                </div>
            </TableCell>
            <TableCell>
                <div className="flex flex-col">
                    <span>{sub.plan_name}</span>
                    <span className="text-xs text-muted-foreground">
                        {formatCurrency(sub.amount)}/{sub.interval}
                    </span>
                </div>
            </TableCell>
            <TableCell>
                <Badge
                    variant="outline"
                    className={cn(
                        "text-xs",
                        sub.status === 'active' && "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
                        sub.status === 'past_due' && "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
                        sub.status === 'canceled' && "bg-red-500/20 text-red-400 border-red-500/30"
                    )}
                >
                    {sub.status}
                </Badge>
            </TableCell>
            <TableCell>
                {sub.client ? (
                    <div className="flex flex-col">
                        <span className="text-emerald-400">{sub.client.name}</span>
                        <span className="text-xs text-muted-foreground">{sub.client.email}</span>
                    </div>
                ) : (
                    <span className="text-muted-foreground">Not linked</span>
                )}
            </TableCell>
            <TableCell>
                {sub.config?.coach ? (
                    <span>{sub.config.coach.name}</span>
                ) : sub.config?.assigned_coach_id ? (
                    <span className="text-muted-foreground">Coach ID set</span>
                ) : (
                    <span className="text-muted-foreground">-</span>
                )}
            </TableCell>
            <TableCell>
                {sub.config?.lead_source ? (
                    <Badge variant="outline" className="text-xs">
                        {sub.config.lead_source === 'company_driven' ? 'Company' : 'Coach'}
                    </Badge>
                ) : (
                    <span className="text-muted-foreground">-</span>
                )}
            </TableCell>
            <TableCell>
                <span className="text-xs text-muted-foreground">
                    {format(new Date(sub.current_period_end), 'MMM dd, yyyy')}
                </span>
            </TableCell>
            <TableCell className="text-right">
                {showLinkButton ? (
                    <Button
                        size="sm"
                        variant="outline"
                        className="bg-emerald-600/20 border-emerald-500/30 hover:bg-emerald-600/30"
                        onClick={() => handleLink(sub)}
                    >
                        <Link2 className="h-4 w-4 mr-1" />
                        Link
                    </Button>
                ) : (
                    <div className="flex gap-2 justify-end">
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleLink(sub)}
                        >
                            <LinkIcon className="h-4 w-4" />
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            onClick={() => handleUnlink(sub.id)}
                            disabled={isUnlinking === sub.id}
                        >
                            <Unlink className="h-4 w-4" />
                        </Button>
                    </div>
                )}
            </TableCell>
        </TableRow>
    );

    return (
        <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-card/40 border-white/5 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Subscriptions</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{subscriptions.length}</div>
                        <p className="text-xs text-muted-foreground">Active in Stripe</p>
                    </CardContent>
                </Card>

                <Card className="bg-card/40 border-white/5 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Linked</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-500">{linked.length}</div>
                        <p className="text-xs text-muted-foreground">Commission tracking active</p>
                    </CardContent>
                </Card>

                <Card className="bg-card/40 border-white/5 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Unlinked</CardTitle>
                        <Link2 className="h-4 w-4 text-yellow-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-yellow-500">{unlinked.length}</div>
                        <p className="text-xs text-muted-foreground">Need configuration</p>
                    </CardContent>
                </Card>
            </div>

            {/* Search */}
            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by email, name, or plan..."
                        className="pl-8 bg-white/5 border-white/10"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <Button
                    variant="outline"
                    className="bg-white/5 border-white/10 hover:bg-white/10"
                    onClick={() => router.refresh()}
                >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                </Button>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="unlinked" className="w-full">
                <TabsList className="bg-white/5">
                    <TabsTrigger value="unlinked">
                        Unlinked ({unlinked.length})
                    </TabsTrigger>
                    <TabsTrigger value="linked">
                        Linked ({linked.length})
                    </TabsTrigger>
                    <TabsTrigger value="all">
                        All ({subscriptions.length})
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="unlinked">
                    <Card className="bg-card/40 border-white/5 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle>Unlinked Subscriptions</CardTitle>
                            <CardDescription>
                                These subscriptions are active in Stripe but not linked to a client/coach for commission tracking.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow className="hover:bg-white/5 border-white/10">
                                        <TableHead>Customer</TableHead>
                                        <TableHead>Plan</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Linked Client</TableHead>
                                        <TableHead>Coach</TableHead>
                                        <TableHead>Lead Source</TableHead>
                                        <TableHead>Next Renewal</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filterSubs(unlinked).length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={8} className="text-center h-24 text-muted-foreground">
                                                {searchQuery ? 'No matching subscriptions found.' : 'All subscriptions are linked!'}
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filterSubs(unlinked).map(sub => (
                                            <SubscriptionRow key={sub.id} sub={sub} showLinkButton />
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="linked">
                    <Card className="bg-card/40 border-white/5 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle>Linked Subscriptions</CardTitle>
                            <CardDescription>
                                These subscriptions are configured for automatic commission tracking on renewals.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow className="hover:bg-white/5 border-white/10">
                                        <TableHead>Customer</TableHead>
                                        <TableHead>Plan</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Linked Client</TableHead>
                                        <TableHead>Coach</TableHead>
                                        <TableHead>Lead Source</TableHead>
                                        <TableHead>Next Renewal</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filterSubs(linked).length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={8} className="text-center h-24 text-muted-foreground">
                                                No linked subscriptions found.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filterSubs(linked).map(sub => (
                                            <SubscriptionRow key={sub.id} sub={sub} />
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="all">
                    <Card className="bg-card/40 border-white/5 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle>All Subscriptions</CardTitle>
                            <CardDescription>
                                All active Stripe subscriptions.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow className="hover:bg-white/5 border-white/10">
                                        <TableHead>Customer</TableHead>
                                        <TableHead>Plan</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Linked Client</TableHead>
                                        <TableHead>Coach</TableHead>
                                        <TableHead>Lead Source</TableHead>
                                        <TableHead>Next Renewal</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filterSubs(subscriptions).length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={8} className="text-center h-24 text-muted-foreground">
                                                No subscriptions found.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filterSubs(subscriptions).map(sub => (
                                            <SubscriptionRow key={sub.id} sub={sub} showLinkButton={!sub.config || !sub.client} />
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Link Dialog */}
            {selectedSubscription && (
                <SubscriptionLinkDialog
                    open={isLinkDialogOpen}
                    onOpenChange={setIsLinkDialogOpen}
                    subscription={selectedSubscription}
                    coaches={coaches}
                    closers={closers}
                    clients={clients}
                    onSuccess={handleLinkSuccess}
                />
            )}
        </div>
    );
}
