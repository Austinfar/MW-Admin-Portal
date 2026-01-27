import { createAdminClient } from '@/lib/supabase/admin'
import { GHLClient } from './client'


// Helper to strip HTML tags
function stripHtml(html: string): string {
    if (!html) return '';
    return html.replace(/<[^>]*>?/gm, '').trim();
}

export async function syncGHLContact(contactOrId: any, client?: GHLClient, customFieldDefinitions?: any[]) {
    // Use Admin Client to bypass RLS policies on 'clients' table during sync
    const supabase = createAdminClient()
    const ghl = client || new GHLClient()

    let contactData: any = null;

    // Always fetch full contact details to ensure we have all data (custom fields, tags, broken down names, etc.)
    // even if we passed in a partial object from an Opportunity.
    let ghlId = typeof contactOrId === 'string' ? contactOrId : (contactOrId.id || contactOrId.contactId);

    if (!ghlId) {
        return { error: 'Missing GHL Contact ID' };
    }

    const response = await ghl.getContact(ghlId);
    if (!response?.contact) {
        console.error(`[Sync Error] GHL Contact not found for ID: ${ghlId}`, response);
        return { error: 'GHL Contact not found' }
    }
    contactData = response.contact;

    // Enrich Custom Fields if definitions provided or fetch them if missing
    let enrichedFields: Record<string, any> = {};
    try {
        let definitions = customFieldDefinitions;
        if (!definitions) {
            // If not provided by caller (e.g. bulk sync), fetch them for this single contact
            const cfRes = await ghl.getCustomFields();
            definitions = cfRes?.customFields || [];
        }

        if (definitions && Array.isArray(definitions) && contactData.customFields) {
            const defMap = new Map(definitions.map((d: any) => [d.id, d.name]));

            // Create a readable map: { "Field Name": "Value" }
            enrichedFields = contactData.customFields.reduce((acc: any, field: any) => {
                const name = defMap.get(field.id);
                if (name) {
                    acc[name] = field.value;
                }
                return acc;
            }, {});
        }
    } catch (err) {
        console.warn('Failed to enrich custom fields:', err);
    }

    // Map GHL fields to Client Schema
    const fullName = contactData.name || `${contactData.firstName || ''} ${contactData.lastName || ''}`;

    // Ensure we have a valid ID 
    const finalGhlId = contactData.id;

    // Email is required by DB schema
    if (!contactData.email) {
        console.warn(`[Sync Skipped] Contact ${finalGhlId} missing email`);
        return { error: 'Missing Email - Required for DB', skipped: true };
    }

    // Lookup Stripe Customer
    let stripeCustomerId = null;
    try {
        const { findStripeCustomer } = await import('@/lib/actions/stripe-sync');
        const searchEmail = contactData.email.trim().toLowerCase();
        console.log(`[Stripe Lookup] Searching for customer with email: '${searchEmail}' (Original: '${contactData.email}')`);

        stripeCustomerId = await findStripeCustomer(searchEmail);
        if (stripeCustomerId) {
            console.log(`[Stripe Match] Linked ${contactData.email} to ${stripeCustomerId}`);
        } else {
            console.log(`[Stripe Info] No customer found for ${contactData.email}`);
        }
    } catch (stripeErr) {
        console.error('Failed to lookup stripe customer', stripeErr);
    }

    // Check if client exists to preserve start_date
    const { data: existingClient } = await supabase
        .from('clients')
        .select('start_date')
        .eq('ghl_contact_id', finalGhlId)
        .single();

    // Prepare raw data with enriched fields
    const ghlRawStored = {
        ...contactData,
        custom_fields_enriched: enrichedFields
    };

    const clientData = {
        ghl_contact_id: finalGhlId,
        name: fullName.trim(),
        email: contactData.email,
        phone: contactData.phone || null,
        // Default to active if syncing
        status: 'active',
        // Store the full raw payload for future reference
        ghl_raw: ghlRawStored,
        // Preserve existing start date, or default to today for new clients
        start_date: existingClient?.start_date || new Date().toISOString(),
        stripe_customer_id: stripeCustomerId
    }

    // Upsert client
    const { data, error } = await supabase
        .from('clients')
        .upsert(clientData, { onConflict: 'ghl_contact_id' })
        .select()
        .single()

    if (error) {
        console.error('Error syncing GHL contact to DB:', error)
        return { error: `DB Error: ${error.message}` }
    }

    // Sync Notes
    try {
        const notesRes = await ghl.getNotes(finalGhlId);
        if (notesRes && notesRes.notes) {
            console.log(`[GHL Info] Found ${notesRes.notes.length} notes for contact ${finalGhlId}`);

            for (const note of notesRes.notes) {
                // Upsert note based on ghl_note_id
                const { error: noteError } = await supabase
                    .from('client_notes')
                    .upsert({
                        client_id: data.id,
                        ghl_note_id: note.id,
                        content: stripHtml(note.body),
                        created_at: note.dateAdded || new Date().toISOString(),
                        last_synced_at: new Date().toISOString(),
                        // Leave author_id null as user might not exist locally
                        is_pinned: false
                    }, {
                        onConflict: 'ghl_note_id',
                        ignoreDuplicates: false
                    });

                if (noteError) {
                    console.error('[Sync Error] Failed to upsert note:', noteError);
                }
            }
        }
    } catch (noteSyncError) {
        console.error('[Sync Error] Failed to sync notes:', noteSyncError);
    }

    return { success: true, client: data, stripeLinked: !!stripeCustomerId }
}

export async function syncGHLLead(contactId: string, client?: GHLClient) {
    const supabase = createAdminClient()
    const ghl = client || new GHLClient()

    if (!contactId) return { error: 'Missing Contact ID' }

    // 1. Fetch Contact from GHL
    const response = await ghl.getContact(contactId)
    if (!response?.contact) {
        console.error(`[Lead Sync Error] GHL Contact not found: ${contactId}`)
        return { error: 'GHL Contact not found' }
    }
    const contact = response.contact

    // 2. Map Data
    const leadData = {
        first_name: contact.firstName || contact.name?.split(' ')[0] || 'Unknown',
        last_name: contact.lastName || contact.name?.split(' ').slice(1).join(' ') || '',
        email: contact.email,
        phone: contact.phone,
        ghl_contact_id: contact.id,
        source: contact.source || 'GHL Pipeline',
        status: 'New', // Default status
        updated_at: new Date().toISOString()
    }

    // 3. Upsert into Leads table
    const { data, error } = await supabase
        .from('leads')
        .upsert(leadData, { onConflict: 'ghl_contact_id' })
        .select()
        .single()

    if (error) {
        console.error('[Lead Sync Error] DB Upsert failed:', error)
        return { error: error.message }
    }

    console.log(`[Lead Sync] Successfully synced lead: ${data.first_name} (${data.id})`)
    return { success: true, lead: data }
}
