'use server';

import { calClient, CalBooking } from '@/lib/cal/client';

export async function getSalesBookings(from: Date, to: Date): Promise<{ bookings: CalBooking[], error?: string }> {
    try {
        const bookings = await calClient.getBookings(from, to);
        return { bookings };
    } catch (error: any) {
        return { bookings: [], error: error.message };
    }
}
