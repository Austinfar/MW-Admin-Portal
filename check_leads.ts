
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRecentLeads() {
    console.log('Fetching recent leads...');
    const { data: leads, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error('Error fetching leads:', error);
        return;
    }

    if (leads && leads.length > 0) {
        console.log(`Found ${leads.length} recent leads:`);
        leads.forEach(lead => {
            console.log(`- ID: ${lead.id}`);
            console.log(`  Name: ${lead.first_name} ${lead.last_name}`);
            console.log(`  Email: ${lead.email}`);
            console.log(`  GHL ID: ${lead.ghl_contact_id}`);
            console.log(`  Created: ${lead.created_at}`);
            console.log(`  Source: ${lead.source}`);
            console.log(`  Status: ${lead.status}`);
            console.log(`  Metadata:`, JSON.stringify(lead.metadata, null, 2));
            console.log('---');
        });

        // Check for duplicates by email in this batch
        const emails = leads.map(l => l.email);
        const duplicates = emails.filter((item, index) => emails.indexOf(item) !== index);
        if (duplicates.length > 0) {
            console.log('POTENTIAL DUPLICATE EMAILS FOUND IN RECENT BATCH:', duplicates);
        } else {
            console.log('No partial duplicates found in top 10 recent leads.');
        }

    } else {
        console.log('No leads found.');
    }
}

checkRecentLeads();
