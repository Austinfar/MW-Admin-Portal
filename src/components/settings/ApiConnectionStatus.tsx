'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, RefreshCw, Loader2, CreditCard, Zap } from 'lucide-react';
import { checkStripeConnection, checkGHLConnection, ApiStatus } from '@/lib/actions/api-health';

interface ConnectionItemProps {
    name: string;
    icon: React.ReactNode;
    status: ApiStatus | null;
    isChecking: boolean;
    onRefresh: () => void;
}

function ConnectionItem({ name, icon, status, isChecking, onRefresh }: ConnectionItemProps) {
    return (
        <div className="flex items-center justify-between p-3 rounded-lg bg-card/50 border border-border/50">
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-primary/10">
                    {icon}
                </div>
                <div>
                    <p className="font-medium text-sm">{name}</p>
                    {status?.error && (
                        <p className="text-xs text-destructive">{status.error}</p>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-2">
                {isChecking ? (
                    <Badge variant="secondary" className="gap-1.5">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Checking...
                    </Badge>
                ) : status === null ? (
                    <Badge variant="secondary">Unknown</Badge>
                ) : status.connected ? (
                    <Badge variant="default" className="gap-1.5 bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/30 border-emerald-500/30">
                        <CheckCircle2 className="h-3 w-3" />
                        Connected
                    </Badge>
                ) : (
                    <Badge variant="destructive" className="gap-1.5">
                        <XCircle className="h-3 w-3" />
                        Disconnected
                    </Badge>
                )}
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={onRefresh}
                    disabled={isChecking}
                >
                    <RefreshCw className={`h-4 w-4 ${isChecking ? 'animate-spin' : ''}`} />
                </Button>
            </div>
        </div>
    );
}

interface ApiConnectionStatusProps {
    initialStripeStatus?: ApiStatus;
    initialGhlStatus?: ApiStatus;
}

export function ApiConnectionStatus({ initialStripeStatus, initialGhlStatus }: ApiConnectionStatusProps) {
    const [stripeStatus, setStripeStatus] = useState<ApiStatus | null>(initialStripeStatus || null);
    const [ghlStatus, setGhlStatus] = useState<ApiStatus | null>(initialGhlStatus || null);
    const [isCheckingStripe, setIsCheckingStripe] = useState(false);
    const [isCheckingGhl, setIsCheckingGhl] = useState(false);

    const checkStripe = async () => {
        setIsCheckingStripe(true);
        try {
            const status = await checkStripeConnection();
            setStripeStatus(status);
        } finally {
            setIsCheckingStripe(false);
        }
    };

    const checkGhl = async () => {
        setIsCheckingGhl(true);
        try {
            const status = await checkGHLConnection();
            setGhlStatus(status);
        } finally {
            setIsCheckingGhl(false);
        }
    };

    const checkAll = async () => {
        checkStripe();
        checkGhl();
    };

    // Check connections on mount if no initial status
    useEffect(() => {
        if (!initialStripeStatus || !initialGhlStatus) {
            checkAll();
        }
    }, []);

    const allConnected = stripeStatus?.connected && ghlStatus?.connected;
    const anyDisconnected = (stripeStatus && !stripeStatus.connected) || (ghlStatus && !ghlStatus.connected);

    return (
        <Card className="bg-card/40 border-primary/5">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            API Connections
                            {allConnected && (
                                <Badge variant="default" className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30 text-xs">
                                    All Systems Operational
                                </Badge>
                            )}
                            {anyDisconnected && (
                                <Badge variant="destructive" className="text-xs">
                                    Connection Issues
                                </Badge>
                            )}
                        </CardTitle>
                        <CardDescription>
                            Monitor your external service connections
                        </CardDescription>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={checkAll}
                        disabled={isCheckingStripe || isCheckingGhl}
                        className="gap-1.5"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${(isCheckingStripe || isCheckingGhl) ? 'animate-spin' : ''}`} />
                        Refresh All
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-2">
                <ConnectionItem
                    name="Stripe"
                    icon={<CreditCard className="h-4 w-4 text-primary" />}
                    status={stripeStatus}
                    isChecking={isCheckingStripe}
                    onRefresh={checkStripe}
                />
                <ConnectionItem
                    name="GoHighLevel"
                    icon={<Zap className="h-4 w-4 text-primary" />}
                    status={ghlStatus}
                    isChecking={isCheckingGhl}
                    onRefresh={checkGhl}
                />
            </CardContent>
        </Card>
    );
}
