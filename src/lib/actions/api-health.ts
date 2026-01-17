'use server';

import { stripe } from '@/lib/stripe';
import { GHLClient } from '@/lib/ghl/client';
import { getAppSettings } from './app-settings';

export type ApiStatus = {
    connected: boolean;
    error?: string;
    lastChecked: string;
};

/**
 * Check Stripe API connection status
 */
export async function checkStripeConnection(): Promise<ApiStatus> {
    try {
        // Try to list 1 customer to verify connection
        await stripe.customers.list({ limit: 1 });
        return {
            connected: true,
            lastChecked: new Date().toISOString()
        };
    } catch (error: any) {
        console.error('[Stripe Health Check] Failed:', error.message);
        return {
            connected: false,
            error: error.message || 'Failed to connect to Stripe',
            lastChecked: new Date().toISOString()
        };
    }
}

/**
 * Check GoHighLevel API connection status
 */
export async function checkGHLConnection(): Promise<ApiStatus> {
    try {
        const settings = await getAppSettings();
        const token = settings['ghl_access_token'];
        const location = settings['ghl_location_id'];

        if (!token || !location) {
            return {
                connected: false,
                error: 'Missing API credentials',
                lastChecked: new Date().toISOString()
            };
        }

        const client = new GHLClient(token, location);
        const result = await client.getPipelines();

        if (!result || !result.pipelines) {
            return {
                connected: false,
                error: 'Failed to fetch pipelines',
                lastChecked: new Date().toISOString()
            };
        }

        return {
            connected: true,
            lastChecked: new Date().toISOString()
        };
    } catch (error: any) {
        console.error('[GHL Health Check] Failed:', error.message);
        return {
            connected: false,
            error: error.message || 'Failed to connect to GoHighLevel',
            lastChecked: new Date().toISOString()
        };
    }
}

/**
 * Check all API connections
 */
export async function checkAllConnections(): Promise<{
    stripe: ApiStatus;
    ghl: ApiStatus;
}> {
    const [stripeStatus, ghlStatus] = await Promise.all([
        checkStripeConnection(),
        checkGHLConnection()
    ]);

    return {
        stripe: stripeStatus,
        ghl: ghlStatus
    };
}
