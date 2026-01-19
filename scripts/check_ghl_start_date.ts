
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
    console.log('Fetching clients...');
    const { data: clients, error } = await supabase
        .from('clients')
        .select('id, name, start_date, ghl_raw')
        .not('ghl_raw', 'is', null)
        .limit(10);

    if (error) {
        console.error('Error fetching clients:', error);
        process.exit(1);
    }

    console.log(`Found ${clients.length} clients with GHL data.`);

    for (const client of clients) {
        const raw = client.ghl_raw || {};
        const enriched = raw.custom_fields_enriched || {};
        const startDate = enriched['Client Program Start Date'];

        console.log('------------------------------------------------');
        console.log(`Client: ${client.name} (${client.id})`);
        console.log(`Current DB Start Date: ${client.start_date}`);
        console.log(`GHL Custom Field 'Start Date': ${startDate} (Type: ${typeof startDate})`);
        console.log('Enriched Keys:', Object.keys(enriched).join(', '));
    }
}

main();
