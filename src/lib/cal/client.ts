/**
 * Cal.com API Client
 * Handles all interactions with the Cal.com API v2
 */

export interface CalBooking {
    id: number;
    uid: string;
    title: string;
    description: string;
    startTime: string;
    endTime: string;
    status: 'ACCEPTED' | 'PENDING' | 'CANCELLED' | 'REJECTED' | 'AWAITING_HOST' | 'IN_PROGRESS' | 'COMPLETED' | 'HOST_NO_SHOW' | 'GUEST_NO_SHOW';
    attendees: {
        email: string;
        name: string;
        timeZone: string;
    }[];
    user?: {
        id: number;
        name: string;
        email: string;
        username: string | null;
    };
    eventType?: {
        id: number;
        slug: string;
        title: string;
    };
    location?: string;
    metadata?: Record<string, unknown>;
    meetingUrl?: string;
}

export interface CalEventType {
    id: number;
    slug: string;
    title: string;
    description: string;
    length: number;
    locations?: { type: string; address?: string; link?: string }[];
}

export interface CalAvailabilitySlot {
    time: string;
}

export interface CalAvailabilityResponse {
    busy: { start: string; end: string }[];
    timeZone: string;
    dateRanges: { start: string; end: string }[];
    slots?: CalAvailabilitySlot[];
}

interface CalBookingsResponse {
    bookings: CalBooking[];
}

interface CalBookingResponse {
    booking: CalBooking;
}

interface CalEventTypesResponse {
    event_types: CalEventType[];
}

const CAL_API_KEY = process.env.CAL_API_KEY;
const CAL_ORGANIZATION_ID = process.env.CAL_ORGANIZATION_ID;
const CAL_API_V2_URL = 'https://api.cal.com/v2';
const CAL_API_V1_URL = 'https://api.cal.com/v1';

export class CalClient {
    private apiKey: string;

    constructor() {
        if (!CAL_API_KEY) {
            console.warn('CAL_API_KEY is not set in environment variables.');
        }
        this.apiKey = CAL_API_KEY || '';
    }

    /**
     * Make a request to Cal.com API v1 (legacy, for some endpoints)
     */
    private async requestV1<T>(
        endpoint: string,
        options: {
            method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
            params?: Record<string, unknown>;
            body?: Record<string, unknown>;
        } = {}
    ): Promise<T> {
        const { method = 'GET', params = {}, body } = options;

        if (!this.apiKey) {
            return { bookings: [] } as unknown as T;
        }

        const url = new URL(`${CAL_API_V1_URL}${endpoint}`);
        url.searchParams.append('apiKey', this.apiKey);

        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                url.searchParams.append(key, String(value));
            }
        });

        const res = await fetch(url.toString(), {
            method,
            headers: {
                'Content-Type': 'application/json',
            },
            body: body ? JSON.stringify(body) : undefined,
            next: { revalidate: 60 }
        });

        if (!res.ok) {
            const error = await res.text();
            throw new Error(`Cal.com API Error: ${res.status} ${res.statusText} - ${error}`);
        }

        return res.json();
    }

    /**
     * Make a request to Cal.com API v2
     */
    private async requestV2<T>(
        endpoint: string,
        options: {
            method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
            params?: Record<string, unknown>;
            body?: Record<string, unknown>;
            revalidate?: number;
        } = {}
    ): Promise<T> {
        const { method = 'GET', params = {}, body, revalidate = 60 } = options;

        if (!this.apiKey) {
            return { data: null } as unknown as T;
        }

        const url = new URL(`${CAL_API_V2_URL}${endpoint}`);

        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                url.searchParams.append(key, String(value));
            }
        });

        const res = await fetch(url.toString(), {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
                'cal-api-version': '2024-08-13',
            },
            body: body ? JSON.stringify(body) : undefined,
            next: { revalidate }
        });

        if (!res.ok) {
            const error = await res.text();
            throw new Error(`Cal.com API v2 Error: ${res.status} ${res.statusText} - ${error}`);
        }

        return res.json();
    }

    /**
     * Fetch bookings within a date range
     * If CAL_ORGANIZATION_ID is set, fetches team bookings via v2 API
     * Otherwise falls back to v1 personal bookings
     */
    async getBookings(from: Date, to: Date): Promise<CalBooking[]> {
        // Try organization bookings first if org ID is configured
        if (CAL_ORGANIZATION_ID) {
            try {
                const orgBookings = await this.getOrganizationBookings(from, to);
                if (orgBookings.length > 0) {
                    return orgBookings;
                }
            } catch (error) {
                console.warn('Failed to fetch organization bookings, falling back to personal:', error);
            }
        }

        // Fall back to v1 personal bookings
        try {
            const response = await this.requestV1<CalBookingsResponse>('/bookings', {
                params: {
                    dateFrom: from.toISOString(),
                    dateTo: to.toISOString(),
                    perPage: 100
                }
            });
            return response.bookings || [];
        } catch (error) {
            console.error('Failed to fetch Cal.com bookings:', error);
            return [];
        }
    }

    /**
     * Fetch organization/team bookings via v2 API
     * Requires CAL_ORGANIZATION_ID and an organization-level API key
     */
    async getOrganizationBookings(from: Date, to: Date): Promise<CalBooking[]> {
        if (!CAL_ORGANIZATION_ID) {
            console.warn('CAL_ORGANIZATION_ID not set, cannot fetch organization bookings');
            return [];
        }

        try {
            // Cal.com v2 organization bookings endpoint
            const response = await this.requestV2<{ status: string; data: CalBooking[] }>(
                `/organizations/${CAL_ORGANIZATION_ID}/bookings`,
                {
                    params: {
                        afterStart: from.toISOString(),
                        beforeEnd: to.toISOString(),
                        take: 100
                    },
                    revalidate: 30 // Shorter cache for team data
                }
            );
            return response.data || [];
        } catch (error) {
            console.error('Failed to fetch organization bookings:', error);
            throw error;
        }
    }

    /**
     * Get a single booking by ID
     */
    async getBookingById(bookingId: number): Promise<CalBooking | null> {
        try {
            const response = await this.requestV1<CalBookingResponse>(`/bookings/${bookingId}`);
            return response.booking || null;
        } catch (error) {
            console.error('Failed to fetch Cal.com booking:', error);
            return null;
        }
    }

    /**
     * Get a single booking by UID
     */
    async getBookingByUid(uid: string): Promise<CalBooking | null> {
        try {
            const response = await this.requestV1<CalBookingResponse>(`/bookings/${uid}`);
            return response.booking || null;
        } catch (error) {
            console.error('Failed to fetch Cal.com booking by UID:', error);
            return null;
        }
    }

    /**
     * Cancel a booking
     */
    async cancelBooking(bookingId: number, reason?: string): Promise<{ success: boolean; error?: string }> {
        try {
            await this.requestV1<{ message: string }>(`/bookings/${bookingId}/cancel`, {
                method: 'DELETE',
                body: reason ? { reason } : undefined
            });
            return { success: true };
        } catch (error) {
            console.error('Failed to cancel Cal.com booking:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to cancel booking'
            };
        }
    }

    /**
     * Reschedule a booking to a new time
     * Note: Cal.com API requires creating a new booking and cancelling the old one
     * Or using the reschedule endpoint if available
     */
    async rescheduleBooking(
        bookingUid: string,
        newStartTime: Date,
        reason?: string
    ): Promise<{ success: boolean; newBooking?: CalBooking; error?: string }> {
        try {
            // Cal.com v1 reschedule endpoint
            const response = await this.requestV1<CalBookingResponse>(`/bookings/${bookingUid}/reschedule`, {
                method: 'PATCH',
                body: {
                    start: newStartTime.toISOString(),
                    rescheduleReason: reason
                }
            });
            return { success: true, newBooking: response.booking };
        } catch (error) {
            console.error('Failed to reschedule Cal.com booking:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to reschedule booking'
            };
        }
    }

    /**
     * Get available time slots for an event type
     */
    async getAvailability(
        eventTypeId: number,
        startTime: Date,
        endTime: Date,
        timeZone: string = 'America/New_York'
    ): Promise<CalAvailabilitySlot[]> {
        try {
            const response = await this.requestV1<{ slots: Record<string, CalAvailabilitySlot[]> }>('/slots', {
                params: {
                    eventTypeId,
                    startTime: startTime.toISOString(),
                    endTime: endTime.toISOString(),
                    timeZone
                }
            });

            // Flatten slots from all dates
            const allSlots: CalAvailabilitySlot[] = [];
            if (response.slots) {
                Object.values(response.slots).forEach(dateSlots => {
                    allSlots.push(...dateSlots);
                });
            }
            return allSlots;
        } catch (error) {
            console.error('Failed to fetch Cal.com availability:', error);
            return [];
        }
    }

    /**
     * Get all event types for the team/user
     */
    async getEventTypes(): Promise<CalEventType[]> {
        try {
            const response = await this.requestV1<CalEventTypesResponse>('/event-types');
            return response.event_types || [];
        } catch (error) {
            console.error('Failed to fetch Cal.com event types:', error);
            return [];
        }
    }

    /**
     * Get upcoming bookings for a specific user (by email)
     */
    async getUpcomingBookingsForUser(userEmail: string, days: number = 7): Promise<CalBooking[]> {
        const now = new Date();
        const future = new Date();
        future.setDate(future.getDate() + days);

        const bookings = await this.getBookings(now, future);

        return bookings.filter(booking =>
            booking.user?.email?.toLowerCase() === userEmail.toLowerCase() &&
            booking.status !== 'CANCELLED'
        );
    }

    /**
     * Get bookings by attendee email
     */
    async getBookingsByAttendee(attendeeEmail: string, from?: Date, to?: Date): Promise<CalBooking[]> {
        const startDate = from || new Date();
        const endDate = to || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

        const bookings = await this.getBookings(startDate, endDate);

        return bookings.filter(booking =>
            booking.attendees?.some(a =>
                a.email.toLowerCase() === attendeeEmail.toLowerCase()
            )
        );
    }

    /**
     * Check if the API key is configured
     */
    isConfigured(): boolean {
        return !!this.apiKey;
    }
}

// Export singleton instance
export const calClient = new CalClient();
