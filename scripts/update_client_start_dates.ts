
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
    console.log('Starting Client Start Date Update...');

    // 1. Fetch all clients with GHL data
    const { data: clients, error } = await supabase
        .from('clients')
        .select('id, name, start_date, ghl_raw')
        .not('ghl_raw', 'is', null);

    if (error) {
        console.error('Error fetching clients:', error);
        process.exit(1);
    }

    console.log(`Found ${clients.length} clients with GHL data to process.`);

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const client of clients) {
        const raw = client.ghl_raw || {};
        const enriched = raw.custom_fields_enriched || {};
        const newStartDate = enriched['Client Program Start Date'];

        if (!newStartDate) {
            skippedCount++;
            // Optional: Log verbose if needed, but keeping it clean for now
            continue;
        }

        // Validate Date Format (YYYY-MM-DD or ISO)
        const dateObj = new Date(newStartDate);
        if (isNaN(dateObj.getTime())) {
            console.warn(`[SKIP] Invalid date format for client ${client.name} (${client.id}): ${newStartDate}`);
            errorCount++;
            continue;
        }

        // Check if update is needed
        if (client.start_date === newStartDate) {
            skippedCount++;
            continue;
        }

        // Perform Update
        const { error: updateError } = await supabase
            .from('clients')
            .update({ start_date: newStartDate })
            .eq('id', client.id);

        if (updateError) {
            console.error(`[ERROR] Failed to update client ${client.name} (${client.id}):`, updateError.message);
            errorCount++;
        } else {
            console.log(`[UPDATE] ${client.name}: ${client.start_date} -> ${newStartDate}`);
            updatedCount++;
        }
    }

    console.log('------------------------------------------------');
    console.log('Update Summary:');
    console.log(`Total Clients Processed: ${clients.length}`);
    console.log(`Updated: ${updatedCount}`);
    console.log(`Skipped (No change/No data): ${skippedCount}`);
    console.log(`Errors: ${errorCount}`);
    console.log('------------------------------------------------');
}

main();
