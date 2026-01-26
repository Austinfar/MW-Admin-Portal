import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import crypto from 'crypto'
import { parseName } from '@/lib/utils/name-parser'
import { logLeadActivity } from '@/lib/actions/lead-actions'

// Cal.com webhook event types
type CalWebhookEvent =
    | 'BOOKING_CREATED'
    | 'BOOKING_CANCELLED'
    | 'BOOKING_RESCHEDULED'
    | 'BOOKING_REQUESTED'
    | 'BOOKING_PAYMENT_INITIATED'
    | 'BOOKING_REJECTED'
    | 'BOOKING_NO_SHOW_UPDATED'
    | 'MEETING_ENDED'
    | 'MEETING_STARTED'
    | 'RECORDING_READY'

interface CalWebhookPayload {
    triggerEvent: CalWebhookEvent
    createdAt: string
    payload: {
        bookingId?: number
        uid?: string
        title?: string
        description?: string
        startTime?: string
        endTime?: string
        status?: string
        eventTypeId?: number
        eventTypeSlug?: string
        location?: string
        meetingUrl?: string
        metadata?: Record<string, unknown>
        attendees?: Array<{
            email: string
            name: string
            timeZone: string
            phone?: string
        }>
        organizer?: {
            id: number
            name: string
            email: string
            username: string
            timeZone: string
        }
        responses?: Record<string, unknown>
        rescheduleUid?: string
        rescheduleReason?: string
        cancellationReason?: string
        noShowHost?: boolean
        noShowGuests?: boolean
        // Additional fields that might contain meeting URL
        videoCallData?: {
            type?: string
            id?: string
            password?: string
            url?: string
        }
        destinationCalendar?: {
            integration?: string
            externalId?: string
        }
    }
}

/**
 * Extract meeting URL from various possible locations in the payload
 * Cal.com stores meeting URLs in different places depending on the integration:
 * - Google Meet: payload.metadata.videoCallUrl
 * - Zoom: payload.videoCallData.url
 * - Direct URL: payload.meetingUrl or payload.location
 */
function extractMeetingUrl(payload: CalWebhookPayload['payload']): string | null {
    // Check direct meetingUrl field
    if (payload.meetingUrl) {
        return payload.meetingUrl
    }

    // Check videoCallData (Zoom integration)
    if (payload.videoCallData?.url) {
        return payload.videoCallData.url
    }

    // Check metadata.videoCallUrl (Google Meet stores URL here)
    const metadata = payload.metadata as Record<string, unknown> | undefined
    if (metadata) {
        // Google Meet URL is typically here
        if (metadata.videoCallUrl && typeof metadata.videoCallUrl === 'string') {
            return metadata.videoCallUrl
        }
        if (metadata.meetingUrl && typeof metadata.meetingUrl === 'string') {
            return metadata.meetingUrl
        }

        // Nested videoCallData in metadata
        const videoCallData = metadata.videoCallData as Record<string, unknown> | undefined
        if (videoCallData?.url && typeof videoCallData.url === 'string') {
            return videoCallData.url
        }
    }

    // Check if location is a URL (direct URL booking)
    if (payload.location && (
        payload.location.startsWith('http://') ||
        payload.location.startsWith('https://') ||
        payload.location.includes('zoom.us') ||
        payload.location.includes('meet.google.com')
    )) {
        return payload.location
    }

    return null
}

/**
 * Extract meeting URL from stored metadata JSON (for backfill/runtime extraction)
 */
export function extractMeetingUrlFromMetadata(metadata: Record<string, unknown> | null): string | null {
    if (!metadata) return null

    // Check direct fields
    if (metadata.meetingUrl && typeof metadata.meetingUrl === 'string') {
        return metadata.meetingUrl
    }

    // Check videoCallData
    const videoCallData = metadata.videoCallData as Record<string, unknown> | undefined
    if (videoCallData?.url && typeof videoCallData.url === 'string') {
        return videoCallData.url
    }

    // Check location if it's a URL
    if (metadata.location && typeof metadata.location === 'string') {
        const loc = metadata.location
        if (loc.startsWith('http://') || loc.startsWith('https://') ||
            loc.includes('zoom.us') || loc.includes('meet.google.com')) {
            return loc
        }
    }

    return null
}

const CAL_WEBHOOK_SECRET = process.env.CAL_WEBHOOK_SECRET

/**
 * Verify Cal.com webhook signature
 */
function verifyWebhookSignature(payload: string, signature: string | null): boolean {
    if (!CAL_WEBHOOK_SECRET || !signature) {
        // If no secret configured, skip validation (dev mode)
        console.warn('[Cal Webhook] No webhook secret configured, skipping signature validation')
        return true
    }

    const expectedSignature = crypto
        .createHmac('sha256', CAL_WEBHOOK_SECRET)
        .update(payload)
        .digest('hex')

    return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
    )
}

/**
 * Extract source parameter from booking metadata or URL
 */
function extractSource(payload: CalWebhookPayload['payload']): 'company-driven' | 'coach-driven' | 'unknown' {
    // Check metadata for source
    const metadata = payload.metadata as Record<string, unknown> | undefined
    if (metadata?.source) {
        const source = String(metadata.source).toLowerCase()
        if (source.includes('company')) return 'company-driven'
        if (source.includes('coach')) return 'coach-driven'
    }

    // Check responses (form fields) for source
    const responses = payload.responses as Record<string, unknown> | undefined
    if (responses?.source) {
        const source = String(responses.source).toLowerCase()
        if (source.includes('company')) return 'company-driven'
        if (source.includes('coach')) return 'coach-driven'
    }

    return 'unknown'
}

/**
 * Send Slack notification for booking events
 */
async function sendSlackNotification(
    event: CalWebhookEvent,
    payload: CalWebhookPayload['payload']
) {
    const slackToken = process.env.SLACK_BOT_TOKEN
    const channelId = process.env.SLACK_SALES_CHANNEL_ID

    if (!slackToken || !channelId) {
        console.log('[Cal Webhook] Slack not configured, skipping notification')
        return
    }

    const attendee = payload.attendees?.[0]
    const organizer = payload.organizer
    const startTime = payload.startTime ? new Date(payload.startTime) : null

    let message = ''
    let emoji = ''

    switch (event) {
        case 'BOOKING_CREATED':
            emoji = ':calendar:'
            message = `*New Booking Created*\n` +
                `*Title:* ${payload.title}\n` +
                `*With:* ${attendee?.name || 'Unknown'} (${attendee?.email || 'No email'})\n` +
                `*Coach:* ${organizer?.name || 'Unknown'}\n` +
                `*When:* ${startTime?.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) || 'TBD'}\n` +
                `*Source:* ${extractSource(payload)}`
            break

        case 'BOOKING_CANCELLED':
            emoji = ':x:'
            message = `*Booking Cancelled*\n` +
                `*Title:* ${payload.title}\n` +
                `*With:* ${attendee?.name || 'Unknown'}\n` +
                `*Reason:* ${payload.cancellationReason || 'No reason provided'}`
            break

        case 'BOOKING_RESCHEDULED':
            emoji = ':arrows_counterclockwise:'
            message = `*Booking Rescheduled*\n` +
                `*Title:* ${payload.title}\n` +
                `*With:* ${attendee?.name || 'Unknown'}\n` +
                `*New Time:* ${startTime?.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) || 'TBD'}\n` +
                `*Reason:* ${payload.rescheduleReason || 'No reason provided'}`
            break

        case 'MEETING_ENDED':
            emoji = ':white_check_mark:'
            message = `*Meeting Ended*\n` +
                `*Title:* ${payload.title}\n` +
                `*With:* ${attendee?.name || 'Unknown'}\n` +
                `Don't forget to log the call outcome!`
            break

        case 'MEETING_STARTED':
            emoji = ':telephone_receiver:'
            message = `*Meeting Started*\n` +
                `*Title:* ${payload.title}\n` +
                `*With:* ${attendee?.name || 'Unknown'}\n` +
                `*Coach:* ${organizer?.name || 'Unknown'}`
            break

        case 'BOOKING_NO_SHOW_UPDATED':
            emoji = ':ghost:'
            const noShowType = payload.noShowHost ? 'Host' : payload.noShowGuests ? 'Guest' : 'Unknown'
            message = `*No-Show Detected*\n` +
                `*Title:* ${payload.title}\n` +
                `*With:* ${attendee?.name || 'Unknown'}\n` +
                `*No-Show:* ${noShowType}\n` +
                `Follow up needed!`
            break

        default:
            return // Don't send notification for other events
    }

    try {
        await fetch('https://slack.com/api/chat.postMessage', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${slackToken}`
            },
            body: JSON.stringify({
                channel: channelId,
                text: `${emoji} ${message}`,
                mrkdwn: true
            })
        })
    } catch (error) {
        console.error('[Cal Webhook] Failed to send Slack notification:', error)
    }
}

/**
 * Extract phone number from various possible locations in the Cal.com payload
 */
function extractPhoneNumber(payload: CalWebhookPayload['payload']): string | null {
    const responses = payload.responses as Record<string, unknown> | undefined
    const metadata = payload.metadata as Record<string, unknown> | undefined
    const attendee = payload.attendees?.[0]

    // Try responses first (form fields) - common field names
    if (responses) {
        const phoneFields = ['phone', 'Phone', 'Phone Number', 'phone_number', 'phoneNumber', 'mobile', 'Mobile']
        for (const field of phoneFields) {
            if (responses[field] && typeof responses[field] === 'string') {
                return responses[field] as string
            }
        }
    }

    // Try metadata
    if (metadata?.phone && typeof metadata.phone === 'string') {
        return metadata.phone
    }

    // Try attendee object (some Cal.com setups include this)
    if (attendee?.phone) {
        return attendee.phone
    }

    return null
}

/**
 * Create or update lead from booking
 */
async function syncLeadFromBooking(
    supabase: ReturnType<typeof createAdminClient>,
    payload: CalWebhookPayload['payload'],
    source: string
) {
    const attendee = payload.attendees?.[0]
    if (!attendee?.email) return null

    // Extract phone number from various sources
    const phone = extractPhoneNumber(payload)

    // Look up organizer user ID for lead assignment
    let assignedUserId: string | null = null
    if (payload.organizer?.email) {
        const { data: organizer } = await supabase
            .from('users')
            .select('id')
            .eq('email', payload.organizer.email.toLowerCase())
            .single()

        assignedUserId = organizer?.id || null
    }

    // Check if lead already exists
    const { data: existingLead } = await supabase
        .from('leads')
        .select('id, status, phone, assigned_user_id, metadata')
        .eq('email', attendee.email.toLowerCase())
        .single()

    if (existingLead) {
        // Build update object for existing lead
        const updates: Record<string, unknown> = {
            updated_at: new Date().toISOString()
        }

        // Merge new metadata (responses) with existing
        if (payload.responses) {
            updates.metadata = {
                ...(existingLead.metadata as object || {}),
                ...payload.responses,
                last_booking_responses: payload.responses
            }
        }

        // Update phone if we found one and lead doesn't have one
        if (phone && !existingLead.phone) {
            updates.phone = phone
        }

        // Update assigned_user_id if not already set
        if (assignedUserId && !existingLead.assigned_user_id) {
            updates.assigned_user_id = assignedUserId
        }

        // Update status to "Appt Set" if it's a new booking
        if (existingLead.status === 'New' || existingLead.status === 'Contacted') {
            updates.status = 'Appt Set'
        }

        await supabase
            .from('leads')
            .update(updates)
            .eq('id', existingLead.id)

        return existingLead.id
    }

    // Parse name using utility function (handles edge cases)
    const { firstName, lastName } = parseName(attendee.name)

    // Create new lead with all extracted data
    const { data: newLead, error } = await supabase
        .from('leads')
        .insert({
            first_name: firstName,
            last_name: lastName,
            email: attendee.email.toLowerCase(),
            phone: phone,
            status: 'Appt Set',
            source: source === 'company-driven' ? 'Company' : 'Coach Referral',
            description: `Created from Cal.com booking: ${payload.title}`,
            assigned_user_id: assignedUserId,
            booked_by_user_id: assignedUserId,
            metadata: {
                ...(payload.responses || {}),
                source_detail: 'Cal.com Booking'
            }
        })
        .select('id')
        .single()

    if (error) {
        console.error('[Cal Webhook] Failed to create lead:', error)
        return null
    }

    return newLead?.id
}

/**
 * Create follow-up task when booking is cancelled
 */
async function createCancellationFollowUp(
    supabase: ReturnType<typeof createAdminClient>,
    leadId: string,
    userId: string | null,
    reason: string | null
) {
    if (!leadId) return

    const callbackDate = new Date()
    callbackDate.setDate(callbackDate.getDate() + 1) // Follow up next day

    await supabase
        .from('follow_up_tasks')
        .insert({
            lead_id: leadId,
            assigned_to: userId,
            outcome_type: 'needs_nurture',
            callback_date: callbackDate.toISOString(),
            notes: `Booking cancelled. Reason: ${reason || 'Not provided'}. Follow up to reschedule.`,
            status: 'pending'
        })
}

export async function POST(req: NextRequest) {
    try {
        const rawBody = await req.text()
        const signature = req.headers.get('x-cal-signature-256')

        // Verify webhook signature
        if (!verifyWebhookSignature(rawBody, signature)) {
            console.error('[Cal Webhook] Invalid signature')
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
        }

        const body: CalWebhookPayload = JSON.parse(rawBody)

        const meetingUrl = extractMeetingUrl(body.payload)

        console.log(`[Cal Webhook] Received event: ${body.triggerEvent}`, {
            bookingId: body.payload.bookingId,
            uid: body.payload.uid,
            title: body.payload.title,
            meetingUrl: meetingUrl,
            location: body.payload.location,
            videoCallData: body.payload.videoCallData
        })

        const supabase = createAdminClient()
        const source = extractSource(body.payload)

        // Handle different event types
        switch (body.triggerEvent) {
            case 'BOOKING_CREATED':
            case 'BOOKING_REQUESTED': {
                // Sync lead from booking
                const leadId = await syncLeadFromBooking(supabase, body.payload, source)

                if (leadId) {
                    await logLeadActivity(
                        supabase,
                        leadId,
                        'Call Scheduled',
                        `Booking created: ${body.payload.title}`
                    )
                }

                // Upsert booking to database
                if (body.payload.bookingId) {
                    const attendee = body.payload.attendees?.[0]

                    await supabase.rpc('upsert_cal_booking', {
                        p_cal_booking_id: body.payload.bookingId,
                        p_cal_uid: body.payload.uid || null,
                        p_title: body.payload.title || null,
                        p_description: body.payload.description || null,
                        p_start_time: body.payload.startTime || new Date().toISOString(),
                        p_end_time: body.payload.endTime || new Date().toISOString(),
                        p_status: body.payload.status || 'PENDING',
                        p_source: source,
                        p_event_type_slug: body.payload.eventTypeSlug || null,
                        p_attendee_email: attendee?.email || null,
                        p_attendee_name: attendee?.name || null,
                        p_attendee_timezone: attendee?.timeZone || null,
                        p_meeting_url: meetingUrl,
                        p_location: body.payload.location || null,
                        p_user_email: body.payload.organizer?.email || null,
                        p_metadata: body.payload as unknown as Record<string, unknown>
                    })
                }

                // Send Slack notification
                await sendSlackNotification('BOOKING_CREATED', body.payload)
                break
            }

            case 'BOOKING_CANCELLED': {
                // Update booking status
                if (body.payload.bookingId) {
                    await supabase
                        .from('cal_bookings')
                        .update({
                            status: 'CANCELLED',
                            cancelled_at: new Date().toISOString(),
                            metadata: body.payload as unknown as Record<string, unknown>
                        })
                        .eq('cal_booking_id', body.payload.bookingId)

                    // Get the booking to find lead and user
                    const { data: booking } = await supabase
                        .from('cal_bookings')
                        .select('lead_id, user_id')
                        .eq('cal_booking_id', body.payload.bookingId)
                        .single()

                    if (booking?.lead_id) {
                        // Update lead status
                        await supabase
                            .from('leads')
                            .update({
                                status: 'Contacted',
                                updated_at: new Date().toISOString()
                            })
                            .eq('id', booking.lead_id)

                        // Create follow-up task
                        await createCancellationFollowUp(
                            supabase,
                            booking.lead_id,
                            booking.user_id,
                            body.payload.cancellationReason || null
                        )
                    }
                }

                // Send Slack notification
                await sendSlackNotification('BOOKING_CANCELLED', body.payload)
                break
            }

            case 'BOOKING_RESCHEDULED': {
                const attendee = body.payload.attendees?.[0]

                // Cal.com creates a NEW booking when rescheduling
                // The rescheduleUid points to the ORIGINAL booking that was rescheduled
                if (body.payload.rescheduleUid) {
                    // Mark the old booking as rescheduled (effectively cancelled)
                    await supabase
                        .from('cal_bookings')
                        .update({
                            status: 'CANCELLED',
                            rescheduled_at: new Date().toISOString(),
                            metadata: {
                                ...(body.payload.metadata || {}),
                                rescheduled_to_uid: body.payload.uid,
                                reschedule_reason: body.payload.rescheduleReason
                            }
                        })
                        .eq('cal_uid', body.payload.rescheduleUid)
                }

                // Create the new booking record
                if (body.payload.bookingId) {
                    await supabase.rpc('upsert_cal_booking', {
                        p_cal_booking_id: body.payload.bookingId,
                        p_cal_uid: body.payload.uid || null,
                        p_title: body.payload.title || null,
                        p_description: body.payload.description || null,
                        p_start_time: body.payload.startTime || new Date().toISOString(),
                        p_end_time: body.payload.endTime || new Date().toISOString(),
                        p_status: body.payload.status || 'ACCEPTED',
                        p_source: source,
                        p_event_type_slug: body.payload.eventTypeSlug || null,
                        p_attendee_email: attendee?.email || null,
                        p_attendee_name: attendee?.name || null,
                        p_attendee_timezone: attendee?.timeZone || null,
                        p_meeting_url: meetingUrl,
                        p_location: body.payload.location || null,
                        p_user_email: body.payload.organizer?.email || null,
                        p_metadata: {
                            ...(body.payload as unknown as Record<string, unknown>),
                            rescheduled_from_uid: body.payload.rescheduleUid
                        }
                    })
                }

                // Send Slack notification
                await sendSlackNotification('BOOKING_RESCHEDULED', body.payload)
                break
            }

            case 'MEETING_ENDED': {
                // Update booking status to completed
                if (body.payload.bookingId) {
                    await supabase
                        .from('cal_bookings')
                        .update({
                            status: 'COMPLETED',
                            metadata: body.payload as unknown as Record<string, unknown>
                        })
                        .eq('cal_booking_id', body.payload.bookingId)
                }

                // Send Slack notification to prompt for call outcome logging
                await sendSlackNotification('MEETING_ENDED', body.payload)
                break
            }

            case 'MEETING_STARTED': {
                // Update booking status to in progress
                if (body.payload.bookingId) {
                    await supabase
                        .from('cal_bookings')
                        .update({
                            status: 'IN_PROGRESS',
                            metadata: body.payload as unknown as Record<string, unknown>
                        })
                        .eq('cal_booking_id', body.payload.bookingId)
                }

                // Send Slack notification
                await sendSlackNotification('MEETING_STARTED', body.payload)
                break
            }

            case 'BOOKING_NO_SHOW_UPDATED': {
                // Update booking status based on who no-showed
                if (body.payload.bookingId) {
                    const noShowStatus = body.payload.noShowHost ? 'HOST_NO_SHOW' : 'GUEST_NO_SHOW'

                    await supabase
                        .from('cal_bookings')
                        .update({
                            status: noShowStatus,
                            metadata: body.payload as unknown as Record<string, unknown>
                        })
                        .eq('cal_booking_id', body.payload.bookingId)

                    // If guest no-showed, create follow-up task for re-engagement
                    if (body.payload.noShowGuests) {
                        const { data: booking } = await supabase
                            .from('cal_bookings')
                            .select('lead_id, user_id')
                            .eq('cal_booking_id', body.payload.bookingId)
                            .single()

                        if (booking?.lead_id) {
                            // Update lead status
                            await supabase
                                .from('leads')
                                .update({
                                    status: 'No Show',
                                    updated_at: new Date().toISOString()
                                })
                                .eq('id', booking.lead_id)

                            // Create urgent follow-up task
                            const callbackDate = new Date()
                            callbackDate.setHours(callbackDate.getHours() + 2) // Follow up in 2 hours

                            await supabase
                                .from('follow_up_tasks')
                                .insert({
                                    lead_id: booking.lead_id,
                                    assigned_to: booking.user_id,
                                    outcome_type: 'no_show',
                                    callback_date: callbackDate.toISOString(),
                                    notes: `Lead no-showed for call: ${body.payload.title}. Follow up ASAP to reschedule.`,
                                    status: 'pending'
                                })
                        }
                    }
                }

                // Send Slack notification
                await sendSlackNotification('BOOKING_NO_SHOW_UPDATED', body.payload)
                break
            }

            default:
                console.log(`[Cal Webhook] Unhandled event type: ${body.triggerEvent}`)
        }

        return NextResponse.json({ received: true, event: body.triggerEvent })
    } catch (error) {
        console.error('[Cal Webhook] Error processing webhook:', error)
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        )
    }
}

// Health check endpoint
export async function GET() {
    return NextResponse.json({
        status: 'ok',
        webhook: 'cal.com',
        configured: !!CAL_WEBHOOK_SECRET
    })
}
