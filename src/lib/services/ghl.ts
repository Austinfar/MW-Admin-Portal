import { createAdminClient } from '@/lib/supabase/admin'
import { getAppSettings } from '@/lib/actions/app-settings'

interface GHLContact {
    email: string
    firstName: string
    lastName: string
    phone: string
    tags?: string[]
    customFields?: Record<string, any>
    // Opportunity Data
    status?: string // Dashboard Status
    value?: number
}

// Configuration: Map Dashboard Status to GHL Pipeline Stage IDs
// TODO: Replace these placeholders with actual GHL Stage IDs
const PIPELINE_ID = process.env.GHL_PIPELINE_ID || 'REPLACE_WITH_PIPELINE_ID'
const STAGE_MAP: Record<string, string> = {
    'New': process.env.GHL_STAGE_NEW_LEAD || 'REPLACE_WITH_STAGE_ID',
    'Contacted': process.env.GHL_STAGE_CONTACTED || 'REPLACE_WITH_STAGE_ID',
    'Call Confirmed': process.env.GHL_STAGE_CONFIRMED || 'REPLACE_WITH_STAGE_ID',
    'Appt Set': process.env.GHL_STAGE_APPT_SET || 'REPLACE_WITH_STAGE_ID',
    'No Show': process.env.GHL_STAGE_NO_SHOW || 'REPLACE_WITH_STAGE_ID',
    'Showed': process.env.GHL_STAGE_SHOWED || 'REPLACE_WITH_STAGE_ID',
    'Closed Won': process.env.GHL_STAGE_WON || 'REPLACE_WITH_STAGE_ID',
    'Closed Lost': process.env.GHL_STAGE_LOST || 'REPLACE_WITH_STAGE_ID'
}
const GHL_CUSTOM_FIELD_OPPORTUNITY_ID = 'mw_opportunity_id'

export async function pushToGHL(contact: GHLContact, options: { isUpdate?: boolean } = {}) {
    // Try to get config from DB (OAuth flow), fallback to Env
    const settings = await getAppSettings()

    const accessToken = settings['ghl_access_token'] || process.env.GHL_ACCESS_TOKEN
    const locationId = settings['ghl_location_id'] || process.env.GHL_LOCATION_ID

    if (!accessToken || !locationId) {
        console.error('[GHL Service] Missing GHL configuration (Token or Location ID missing in DB/Env)')
        return { error: 'Missing GHL config' }
    }

    try {
        // 1. Sync Contact
        const contactBody = {
            email: contact.email,
            firstName: contact.firstName,
            lastName: contact.lastName,
            phone: contact.phone,
            locationId: locationId,
            tags: contact.tags || [],
            customFields: Object.entries(contact.customFields || {}).map(([key, value]) => ({
                key,
                field_value: value
            }))
        }

        console.log('[GHL Service] Syncing contact:', contact.email)

        // Use upsert endpoint to handle both create and update
        const contactRes = await fetch('https://services.leadconnectorhq.com/contacts/upsert', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Version': '2021-07-28',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(contactBody)
        })

        const contactData = await contactRes.json()

        if (!contactRes.ok) {
            console.error('[GHL Service] Contact Sync Failed:', contactData)
            return { error: 'Contact Sync Failed', details: contactData }
        }

        const ghlContactId = contactData.contact?.id
        console.log(`[GHL Service] Contact Synced. GHL ID: ${ghlContactId}`)

        // 1.5 Explicitly Add Tags (Upsert can sometimes overwrite or ignore tags depending on GHL config)
        if (contact.tags && contact.tags.length > 0 && ghlContactId) {
            try {
                const tagRes = await fetch(`https://services.leadconnectorhq.com/contacts/${ghlContactId}/tags`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Version': '2021-07-28',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        tags: contact.tags
                    })
                })

                if (!tagRes.ok) {
                    const tagData = await tagRes.json()
                    console.error('[GHL Service] Failed to add tags:', tagData)
                } else {
                    console.log(`[GHL Service] Tags added to contact ${ghlContactId}:`, contact.tags)
                }
            } catch (tagError) {
                console.error('[GHL Service] Exception adding tags:', tagError)
            }
        }

        // 2. Sync Opportunity (if Status maps to a Stage)
        const stageId = STAGE_MAP[contact.status || '']
        if (stageId && PIPELINE_ID !== 'REPLACE_WITH_PIPELINE_ID') {
            const oppName = `${contact.firstName} ${contact.lastName}`.trim() || contact.email

            const oppBody = {
                pipelineId: PIPELINE_ID,
                locationId: locationId,
                contactId: ghlContactId,
                name: oppName,
                status: contact.status === 'Closed Won' ? 'won'
                    : contact.status === 'Closed Lost' ? 'lost'
                        : 'open',
                pipelineStageId: stageId,
                monetaryValue: contact.value || 0
            }

            console.log(`[GHL Service] Syncing Opportunity: "${oppName}" to Stage ${stageId}`)

            const oppRes = await fetch('https://services.leadconnectorhq.com/opportunities/', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Version': '2021-07-28',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(oppBody)
            })

            const oppData = await oppRes.json()
            if (!oppRes.ok) {
                console.error('[GHL Service] Opportunity Sync Failed:', oppData)
                // Don't fail the whole operation, just log
            } else {
                console.log('[GHL Service] Opportunity Synced:', oppData.opportunity?.id)

                // 3. Update Contact with Opportunity ID for Automations
                if (oppData.opportunity?.id) {
                    try {
                        await fetch(`https://services.leadconnectorhq.com/contacts/${ghlContactId}`, {
                            method: 'PUT',
                            headers: {
                                'Authorization': `Bearer ${accessToken}`,
                                'Version': '2021-07-28',
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                customFields: [
                                    {
                                        key: GHL_CUSTOM_FIELD_OPPORTUNITY_ID,
                                        field_value: oppData.opportunity.id
                                    }
                                ]
                            })
                        })
                        console.log(`[GHL Service] Updated Contact with Opportunity ID: ${oppData.opportunity.id}`)
                    } catch (updateError) {
                        console.error('[GHL Service] Failed to update contact with Opp ID:', updateError)
                    }
                }

                return { success: true, ghlContactId, ghlOpportunityId: oppData.opportunity?.id }
            }
        }

        return { success: true, ghlContactId }

    } catch (error: any) {
        console.error('[GHL Service] Exception:', error)
        return { error: error.message }
    }
}
