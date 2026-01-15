'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { updateAppSetting } from '@/lib/actions/app-settings';

interface GHLConnectionSettingsProps {
    initialAccessToken?: string;
    initialLocationId?: string;
}

export function GHLConnectionSettings({ initialAccessToken = '', initialLocationId = '' }: GHLConnectionSettingsProps) {
    const [accessToken, setAccessToken] = useState(initialAccessToken);
    const [locationId, setLocationId] = useState(initialLocationId);
    const [isLoading, setIsLoading] = useState(false);

    const handleSave = async () => {
        setIsLoading(true);
        try {
            await Promise.all([
                updateAppSetting('ghl_access_token', accessToken),
                updateAppSetting('ghl_location_id', locationId)
            ]);
            toast.success('Settings saved successfully');
        } catch (error) {
            toast.error('Failed to save settings');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card className="bg-card/40 border-primary/5">
            <CardHeader>
                <CardTitle>GoHighLevel Connection</CardTitle>
                <CardDescription>
                    Enter your API credentials to enable pipeline syncing.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="accessToken">Access Token</Label>
                    <Input
                        id="accessToken"
                        type="password"
                        value={accessToken}
                        onChange={(e) => setAccessToken(e.target.value)}
                        placeholder="ghl_..."
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="locationId">Location ID</Label>
                    <Input
                        id="locationId"
                        value={locationId}
                        onChange={(e) => setLocationId(e.target.value)}
                        placeholder="Location ID"
                    />
                </div>
            </CardContent>
            <CardFooter>
                <Button onClick={handleSave} disabled={isLoading}>
                    {isLoading ? 'Saving...' : 'Save Credentials'}
                </Button>
            </CardFooter>
        </Card>
    );
}
