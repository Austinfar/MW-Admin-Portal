/**
 * Slack API Client
 * Handles sending messages to channels and direct messages
 */

export interface SlackBlock {
    type: string
    text?: {
        type: string
        text: string
        emoji?: boolean
    }
    elements?: SlackBlock[]
    fields?: { type: string; text: string }[]
    accessory?: SlackBlock
    block_id?: string
    image_url?: string
    alt_text?: string
}

export interface SlackMessage {
    text: string // Fallback text for notifications
    blocks?: SlackBlock[]
    unfurl_links?: boolean
    unfurl_media?: boolean
}

interface SlackResponse {
    ok: boolean
    error?: string
    ts?: string
    channel?: string
}

const SLACK_CONFIG = {
    BOT_TOKEN: process.env.SLACK_BOT_TOKEN || '',
    SALES_CHANNEL_ID: process.env.SLACK_SALES_CHANNEL_ID || '',
    API_URL: 'https://slack.com/api',
}

/**
 * Send a message to a Slack channel
 */
export async function postToChannel(
    channelId: string,
    message: SlackMessage
): Promise<{ success: boolean; error?: string; ts?: string }> {
    if (!SLACK_CONFIG.BOT_TOKEN) {
        console.warn('[Slack] Bot token not configured')
        return { success: false, error: 'Slack bot token not configured' }
    }

    try {
        const response = await fetch(`${SLACK_CONFIG.API_URL}/chat.postMessage`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${SLACK_CONFIG.BOT_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                channel: channelId,
                text: message.text,
                blocks: message.blocks,
                unfurl_links: message.unfurl_links ?? false,
                unfurl_media: message.unfurl_media ?? false,
            }),
        })

        const data: SlackResponse = await response.json()

        if (!data.ok) {
            console.error('[Slack] API error:', data.error)
            return { success: false, error: data.error }
        }

        return { success: true, ts: data.ts }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error('[Slack] Request failed:', errorMessage)
        return { success: false, error: errorMessage }
    }
}

/**
 * Send a direct message to a Slack user
 */
export async function sendDirectMessage(
    slackUserId: string,
    message: SlackMessage
): Promise<{ success: boolean; error?: string; ts?: string }> {
    if (!SLACK_CONFIG.BOT_TOKEN) {
        console.warn('[Slack] Bot token not configured')
        return { success: false, error: 'Slack bot token not configured' }
    }

    if (!slackUserId) {
        return { success: false, error: 'No Slack user ID provided' }
    }

    try {
        // First, open a DM channel with the user
        const openResponse = await fetch(`${SLACK_CONFIG.API_URL}/conversations.open`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${SLACK_CONFIG.BOT_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ users: slackUserId }),
        })

        const openData = await openResponse.json()

        if (!openData.ok) {
            console.error('[Slack] Failed to open DM channel:', openData.error)
            return { success: false, error: `Failed to open DM: ${openData.error}` }
        }

        const dmChannelId = openData.channel.id

        // Send the message to the DM channel
        return postToChannel(dmChannelId, message)
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error('[Slack] DM request failed:', errorMessage)
        return { success: false, error: errorMessage }
    }
}

/**
 * Post a sale celebration to the configured sales channel
 */
export async function postToSalesChannel(
    message: SlackMessage
): Promise<{ success: boolean; error?: string; ts?: string }> {
    if (!SLACK_CONFIG.SALES_CHANNEL_ID) {
        console.warn('[Slack] Sales channel ID not configured')
        return { success: false, error: 'Sales channel ID not configured' }
    }

    return postToChannel(SLACK_CONFIG.SALES_CHANNEL_ID, message)
}

/**
 * Check if Slack is configured and available
 */
export function isSlackConfigured(): boolean {
    return Boolean(SLACK_CONFIG.BOT_TOKEN && SLACK_CONFIG.SALES_CHANNEL_ID)
}
