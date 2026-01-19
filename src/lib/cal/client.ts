export interface CalBooking {
    id: number;
    title: string;
    description: string;
    startTime: string;
    endTime: string;
    status: 'ACCEPTED' | 'PENDING' | 'CANCELLED' | 'REJECTED';
    attendees: {
        email: string;
        name: string;
        timeZone: string;
    }[];
    user?: {
        name: string;
        email: string;
        username: string | null;
    }
}

interface CalBookingsResponse {
    bookings: CalBooking[];
}

const CAL_API_KEY = process.env.CAL_API_KEY;

export class CalClient {
    private apiKey: string;
    private baseUrl = 'https://api.cal.com/v1';

    constructor() {
        if (!CAL_API_KEY) {
            console.warn('CAL_API_KEY is not set in environment variables.');
        }
        this.apiKey = CAL_API_KEY || '';
    }

    private async request<T>(endpoint: string, params: Record<string, any> = {}): Promise<T> {
        if (!this.apiKey) {
            // Return empty data if no key to prevent crashes during dev
            return { bookings: [] } as any;
        }

        const url = new URL(`${this.baseUrl}${endpoint}`);
        url.searchParams.append('apiKey', this.apiKey);

        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                url.searchParams.append(key, String(value));
            }
        });

        const res = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
            next: { revalidate: 60 } // Cache for 1 minute
        });

        if (!res.ok) {
            const error = await res.text();
            throw new Error(`Cal.com API Error: ${res.status} ${res.statusText} - ${error}`);
        }

        return res.json();
    }

    /**
     * Fetch bookings within a date range
     */
    async getBookings(from: Date, to: Date): Promise<CalBooking[]> {
        try {
            const response = await this.request<CalBookingsResponse>('/bookings', {
                dateFrom: from.toISOString(),
                dateTo: to.toISOString(),
                perPage: 100 // Adjust as needed
            });
            return response.bookings || [];
        } catch (error) {
            console.error('Failed to fetch Cal.com bookings:', error);
            return [];
        }
    }
}

export const calClient = new CalClient();
