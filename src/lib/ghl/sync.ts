import { createAdminClient } from '@/lib/supabase/admin'
import { GHLClient } from './client'

export async function syncGHLContact(contactOrId: any, client?: GHLClient) {
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
        stripeCustomerId = await findStripeCustomer(contactData.email);
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

    const clientData = {
        ghl_contact_id: finalGhlId,
        name: fullName.trim(),
        email: contactData.email,
        phone: contactData.phone || null,
        // Default to active if syncing
        status: 'active',
        // Store the full raw payload for future reference
        ghl_raw: contactData,
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

    return { success: true, client: data, stripeLinked: !!stripeCustomerId }
}
