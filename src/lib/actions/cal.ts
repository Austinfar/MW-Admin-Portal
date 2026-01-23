'use server';

import { createClient } from '@/lib/supabase/server';
import { CalBooking } from '@/lib/cal/client';

/**
 * Fetch sales bookings from the local database (populated by webhooks)
 * This provides team-wide bookings without needing organization-level API access
 * @param from - Start date for the query range
 * @param to - End date for the query range
 * @param includeCancelled - Whether to include cancelled/rescheduled bookings (default: false)
 */
export async function getSalesBookings(
    from: Date,
    to: Date,
    includeCancelled: boolean = false
): Promise<{ bookings: CalBooking[], error?: string }> {
    try {
        const supabase = await createClient();

        let query = supabase
            .from('cal_bookings')
            .select(`
                id,
                cal_booking_id,
                cal_uid,
                user_id,
                lead_id,
                title,
                description,
                start_time,
                end_time,
                status,
                source,
                event_type_slug,
                attendee_email,
                attendee_name,
                attendee_timezone,
                meeting_url,
                location,
                metadata,
                rescheduled_at,
                users:user_id (
                    id,
                    name,
                    email
                )
            `)
            .gte('start_time', from.toISOString())
            .lte('end_time', to.toISOString())
            .order('start_time', { ascending: true });

        // Filter out cancelled bookings unless explicitly requested
        if (!includeCancelled) {
            query = query.not('status', 'eq', 'CANCELLED');
        }

        const { data, error } = await query;

        if (error) {
            console.error('Failed to fetch bookings from database:', error);
            return { bookings: [], error: error.message };
        }

        // Transform database records to CalBooking format
        const bookings: CalBooking[] = (data || []).map((booking: any) => ({
            id: booking.cal_booking_id,
            uid: booking.cal_uid || '',
            title: booking.title || 'Booking',
            description: booking.description || '',
            startTime: booking.start_time,
            endTime: booking.end_time,
            status: booking.status as CalBooking['status'],
            attendees: booking.attendee_email ? [{
                email: booking.attendee_email,
                name: booking.attendee_name || 'Guest',
                timeZone: booking.attendee_timezone || 'America/New_York'
            }] : [],
            user: booking.users ? {
                id: 0, // DB uses UUID, Cal uses number
                name: booking.users.name || '',
                email: booking.users.email || '',
                username: null
            } : undefined,
            eventType: booking.event_type_slug ? {
                id: 0,
                slug: booking.event_type_slug,
                title: booking.event_type_slug
            } : undefined,
            location: booking.location || undefined,
            meetingUrl: booking.meeting_url || undefined,
            metadata: booking.metadata || undefined
        }));

        return { bookings };
    } catch (error: any) {
        console.error('Failed to fetch sales bookings:', error);
        return { bookings: [], error: error.message };
    }
}
