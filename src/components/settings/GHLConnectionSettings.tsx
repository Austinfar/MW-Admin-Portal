'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { updateAppSetting } from '@/lib/actions/app-settings';
import { connectGHL } from '@/lib/actions/ghl-connect';
import { CheckCircle2, AlertCircle, Link as LinkIcon, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface GHLConnectionSettingsProps {
    initialAccessToken?: string;
    initialRefreshToken?: string;
    initialLocationId?: string;
}

export function GHLConnectionSettings({ initialAccessToken = '', initialRefreshToken = '', initialLocationId = '' }: GHLConnectionSettingsProps) {
    const hasToken = !!initialAccessToken;
    const isOauth = !!initialRefreshToken; // OAuth connections always have a refresh token
    const isConnected = hasToken && isOauth;
    const isLegacy = hasToken && !isOauth;

    const [isLoading, setIsLoading] = useState(false);

    // Manual fallback state
    const [manualOpen, setManualOpen] = useState(false);
    const [manualToken, setManualToken] = useState(initialAccessToken);
    const [manualLocation, setManualLocation] = useState(initialLocationId);

    const handleConnect = async () => {
        setIsLoading(true);
        try {
            await connectGHL();
        } catch (error) {
            console.error(error);
            toast.error('Failed to initiate connection');
            setIsLoading(false);
        }
    };

    const handleDisconnect = async () => {
        if (!confirm('Are you sure you want to disconnect? Syncing will stop.')) return;
        setIsLoading(true);
        try {
            await updateAppSetting('ghl_access_token', '');
            await updateAppSetting('ghl_refresh_token', '');
            await updateAppSetting('ghl_location_id', '');
            await updateAppSetting('ghl_token_expires_at', '');
            toast.success('Disconnected from GoHighLevel');
        } catch (error) {
            toast.error('Failed to disconnect');
        } finally {
            setIsLoading(false);
        }
    };

    const handleManualSave = async () => {
        setIsLoading(true);
        try {
            await Promise.all([
                updateAppSetting('ghl_access_token', manualToken),
                updateAppSetting('ghl_location_id', manualLocation)
            ]);
            toast.success('Settings saved manually');
        } catch (error) {
            toast.error('Failed to save settings');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card className="bg-card/40 border-primary/5">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2">
                            GoHighLevel Integration
                            {isConnected ? (
                                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Active</Badge>
                            ) : isLegacy ? (
                                <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">Legacy Key</Badge>
                            ) : (
                                <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>
                            )}
                        </CardTitle>
                        <CardDescription>
                            Connect your GoHighLevel account to enable two-way syncing.
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">

                {isConnected ? (
                    <div className="flex flex-col gap-4 p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                            </div>
                            <div>
                                <h4 className="text-sm font-medium">Successfully Connected</h4>
                                <p className="text-xs text-muted-foreground">
                                    Location ID: <span className="font-mono text-foreground">{initialLocationId}</span>
                                </p>
                            </div>
                        </div>
                        <Button variant="destructive" size="sm" onClick={handleDisconnect} disabled={isLoading} className="self-start">
                            Disconnect
                        </Button>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        {isLegacy && (
                            <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-500/5 border border-amber-500/10 mb-2">
                                <AlertCircle className="h-5 w-5 text-amber-500" />
                                <div>
                                    <h4 className="text-sm font-medium text-amber-500">Legacy Connection Detected</h4>
                                    <p className="text-xs text-muted-foreground">
                                        You are using a manual API key. We recommend upgrading to the new secure OAuth connection.
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="p-4 rounded-lg bg-primary/5 border border-primary/10">
                            <h4 className="text-sm font-medium mb-2">
                                {isLegacy ? 'Upgrade to OAuth (Recommended)' : 'Automatic Connection (Recommended)'}
                            </h4>
                            <p className="text-xs text-muted-foreground mb-4">
                                Securely connect using your GHL login. Handles token refreshing automatically.
                            </p>
                            <Button onClick={handleConnect} disabled={isLoading} className="w-full sm:w-auto bg-[#1577ff] hover:bg-[#0c65e0]">
                                <LinkIcon className="mr-2 h-4 w-4" />
                                {isLegacy ? 'Connect with GoHighLevel (Upgrade)' : 'Connect with GoHighLevel'}
                            </Button>
                        </div>
                    </div>
                )}

                <Collapsible open={manualOpen} onOpenChange={setManualOpen} className="border-t pt-4">
                    <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
                            {manualOpen ? 'Hide Manual Configuration' : 'Show Manual Configuration (Advanced)'}
                        </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <Label htmlFor="accessToken">Access Token</Label>
                            <Input
                                id="accessToken"
                                type="password"
                                value={manualToken}
                                onChange={(e) => setManualToken(e.target.value)}
                                placeholder="ghl_..."
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="locationId">Location ID</Label>
                            <Input
                                id="locationId"
                                value={manualLocation}
                                onChange={(e) => setManualLocation(e.target.value)}
                                placeholder="Location ID"
                            />
                        </div>
                        <Button onClick={handleManualSave} disabled={isLoading} size="sm" variant="outline">
                            Save Manually
                        </Button>
                    </CollapsibleContent>
                </Collapsible>

            </CardContent>
        </Card>
    );
}
