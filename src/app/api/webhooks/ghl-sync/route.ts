import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Initialize Supabase Client (Admin access required to update ghl_contact_id without RLS issues)
// Note: In Next.js App Router, env vars are accessed via process.env
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ghlAccessToken = process.env.GHL_ACCESS_TOKEN!;
const ghlLocationId = process.env.GHL_LOCATION_ID!;

export async function POST(req: Request) {
    try {
        // 1. Parse Webhook Payload from Supabase
        // Payload structure: { type: 'INSERT' | 'UPDATE', table: 'booking_sessions', record: { ... }, old_record: { ... } }
        const payload = await req.json();
        const { record, type } = payload;

        console.log(`[GHL Sync] Received webhook: ${type} for session ${record.id}`);

        // Start with basic validation
        if (!record || !record.email) {
            console.log('[GHL Sync] Skipping: No record or email found');
            return NextResponse.json({ message: 'Skipped: No email' }, { status: 200 });
        }

        // 2. Map Payload to GHL Contact Object
        const ghlContact = {
            email: record.email,
            firstName: record.first_name,
            lastName: record.last_name,
            phone: record.phone,
            locationId: ghlLocationId,
            tags: ['lead'], // Default tag, can be enhanced logic
            customFields: [] as any[],
        };

        // Add Attribution Data as Custom Fields or Tags if needed
        if (record.utm_source) ghlContact.tags.push(`source:${record.utm_source}`);
        if (record.ghl_contact_id) {
            // If we already have a GHL ID, this might be an update. 
            // However, the standard "create" endpoint usually upserts by email/phone.
            // We can explicitly strictly update if we wanted, but upsert is safer.
        }

        // 3. Send to GHL API
        console.log('[GHL Sync] Sending to GHL:', ghlContact.email);

        const ghlRes = await fetch('https://services.leadconnectorhq.com/contacts/', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${ghlAccessToken}`,
                'Version': '2021-07-28',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(ghlContact)
        });

        const ghlData = await ghlRes.json();

        if (!ghlRes.ok) {
            console.error('[GHL Sync] API Error:', ghlData);
            return NextResponse.json({ error: 'GHL API Failed', details: ghlData }, { status: 500 });
        }

        const newContactId = ghlData.contact?.id;
        console.log(`[GHL Sync] Success! GHL ID: ${newContactId}`);

        // 4. Update Supabase with GHL ID to prevent future sync loops or duplicates
        if (newContactId && newContactId !== record.ghl_contact_id) {
            const supabase = createClient(supabaseUrl, supabaseServiceKey);
            await supabase
                .from('booking_sessions')
                .update({ ghl_contact_id: newContactId })
                .eq('id', record.id);
            console.log('[GHL Sync] Updated Supabase record with GHL ID');
        }

        return NextResponse.json({ success: true, ghlContactId: newContactId });

    } catch (error: any) {
        console.error('[GHL Sync] Internal Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
