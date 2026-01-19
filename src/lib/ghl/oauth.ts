import { GHL_CONFIG } from './config'

const GHL_AUTH_URL = 'https://marketplace.leadconnectorhq.com/oauth/chooselocation'
const GHL_TOKEN_URL = 'https://services.leadconnectorhq.com/oauth/token'

export function getAuthorizationUrl(redirectUri: string) {
    const scopes = [
        'contacts.readonly',
        'contacts.write',
        'opportunities.readonly',
        'opportunities.write',
        'conversations.readonly',
        'conversations.write',
        'conversations/message.readonly',
        'conversations/message.write',
        'calendars.readonly',
        'calendars.write',
        'users.readonly',
        'locations.readonly',
        'offline_access'
    ].join(' ')

    const params = new URLSearchParams({
        response_type: 'code',
        redirect_uri: redirectUri,
        client_id: GHL_CONFIG.CLIENT_ID || '',
        scope: scopes,
    })

    return `${GHL_AUTH_URL}?${params.toString()}`
}

export async function exchangeCodeForToken(code: string, redirectUri: string) {
    const body = new URLSearchParams({
        client_id: GHL_CONFIG.CLIENT_ID || '',
        client_secret: GHL_CONFIG.CLIENT_SECRET || '',
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        user_type: 'Location',
    })

    const response = await fetch(GHL_TOKEN_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
        },
        body
    })

    if (!response.ok) {
        const errorText = await response.text()
        console.error('GHL Token Exchange Failed:', errorText)
        throw new Error(`Failed to exchange token: ${errorText}`)
    }

    return response.json()
}

export async function refreshAccessToken(refreshToken: string) {
    const body = new URLSearchParams({
        client_id: GHL_CONFIG.CLIENT_ID || '',
        client_secret: GHL_CONFIG.CLIENT_SECRET || '',
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        user_type: 'Location',
    })

    const response = await fetch(GHL_TOKEN_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
        },
        body
    })

    if (!response.ok) {
        const errorText = await response.text()
        console.error('GHL Token Refresh Failed:', errorText)
        throw new Error(`Failed to refresh token: ${errorText}`)
    }

    return response.json()
}
