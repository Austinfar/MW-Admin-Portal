import { GHLClient } from './client';
import { getAppSettings, updateAppSetting } from '@/lib/actions/app-settings';

/**
 * Creates an authenticated GHL client using credentials stored in the database.
 * Handles automatic token refreshing and persistence.
 */
export async function getAuthenticatedGHLClient() {
    const settings = await getAppSettings();
    const token = settings['ghl_access_token'];
    const refreshToken = settings['ghl_refresh_token'];
    const location = settings['ghl_location_id'];

    console.log('[GHL Factory] Using credentials from DB:', { tokenExists: !!token, location });

    return new GHLClient(token, location, {
        refreshToken,
        onTokenRefresh: async (newTokens) => {
            console.log('[GHL Factory] Refreshing stored tokens via callback');
            await updateAppSetting('ghl_access_token', newTokens.access_token);
            await updateAppSetting('ghl_refresh_token', newTokens.refresh_token);
            if (newTokens.expires_in) {
                const expiresAt = new Date(Date.now() + newTokens.expires_in * 1000).toISOString();
                await updateAppSetting('ghl_token_expires_at', expiresAt);
            }
        }
    });
}
