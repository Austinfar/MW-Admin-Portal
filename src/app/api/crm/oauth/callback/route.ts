
import { exchangeCodeForToken } from '@/lib/ghl/oauth';
import { updateAppSetting } from '@/lib/actions/app-settings';
import { redirect } from 'next/navigation';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');

    if (!code) {
        return redirect('/settings?error=ghl_no_code');
    }

    try {
        // Construct the redirect URI based on the current environment
        // NOTE: This must match exactly what was registered in the GHL App
        const protocol = request.headers.get('x-forwarded-proto') || 'http';
        const host = request.headers.get('host');
        const redirectUri = `${protocol}://${host}/api/crm/oauth/callback`;

        console.log('[GHL OAuth] Exchanging code...', { redirectUri });

        const tokenData = await exchangeCodeForToken(code, redirectUri);

        // Store tokens securely in app_settings (RLS-protected table)
        await updateAppSetting('ghl_access_token', tokenData.access_token);
        await updateAppSetting('ghl_refresh_token', tokenData.refresh_token);

        // Calculate expiry (expires_in is usually in seconds)
        // Store as ISO string
        if (tokenData.expires_in) {
            const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();
            await updateAppSetting('ghl_token_expires_at', expiresAt);
        }

        // Store Location ID if present (User Type = Location)
        if (tokenData.locationId) {
            await updateAppSetting('ghl_location_id', tokenData.locationId);
        }

        return redirect('/settings?ghl_connected=true');

    } catch (error) {
        console.error('[GHL OAuth] Callback failed:', error);
        return redirect('/settings?error=ghl_exchange_failed');
    }
}
