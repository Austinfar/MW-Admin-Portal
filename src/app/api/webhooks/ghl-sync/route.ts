import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { pushToGHL } from '@/lib/services/ghl';

// Initialize Supabase Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: Request) {
    try {
        const payload = await req.json();
        const { record, type, table } = payload; // 'table' available if using pg_net or custom trigger payload

        console.log(`[GHL Sync] Received webhook: ${type} on ${table || 'booking_sessions'} for ${record.id}`);

        if (!record || !record.email) {
            return NextResponse.json({ message: 'Skipped: No record or email' }, { status: 200 });
        }

        // Construct GHL Contact Object
        const contactData: any = {
            email: record.email,
            firstName: record.first_name,
            lastName: record.last_name,
            phone: record.phone,
            tags: [],
            status: record.status // 'New' by default in booking_sessions, or actual status in leads
        };

        // 1. Map Data from Booking Session
        // (Table might be explicit or implied by payload structure)
        if (record.utm_source) contactData.tags.push(`source:${record.utm_source}`);
        if (record.setter_id) contactData.tags.push('setter_attributed');

        // 2. Map Data from Leads (if it's a lead update)
        if (record.booked_by_user_id) contactData.tags.push('setter_assigned');
        if (record.source) contactData.tags.push(`source:${record.source}`);

        // Execute Sync
        const result = await pushToGHL(contactData, { isUpdate: type === 'UPDATE' });

        if (result.error) {
            return NextResponse.json({ error: result.error, details: result.details }, { status: 500 });
        }

        // Update DB with GHL ID if new
        if (result.ghlContactId && result.ghlContactId !== record.ghl_contact_id) {
            const supabase = createClient(supabaseUrl, supabaseServiceKey);
            const tableName = table || 'booking_sessions'; // Default for backward compat

            // Only update if the column exists (booking_sessions and leads both have it now)
            await supabase
                .from(tableName)
                .update({ ghl_contact_id: result.ghlContactId })
                .eq('id', record.id);

            console.log(`[GHL Sync] Updated ${tableName} with GHL ID`);
        }

        return NextResponse.json(result);

    } catch (error: any) {
        console.error('[GHL Sync] Internal Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
