
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
    console.log('Fetching recent leads (concise)...');
    const { data: leads, error } = await supabase
        .from('leads')
        .select('id, first_name, last_name, email, created_at, source, status')
        .order('created_at', { ascending: false })
        .limit(20);

    if (error) {
        console.error('Error fetching leads:', error);
        return;
    }

    if (leads && leads.length > 0) {
        console.table(leads.map(l => ({
            name: `${l.first_name} ${l.last_name}`,
            email: l.email,
            created: new Date(l.created_at).toISOString(),
            source: l.source,
            id: l.id
        })));

        // Check for duplicates by email in this batch
        const emails = leads.map(l => l.email).filter(e => e);
        const duplicates = emails.filter((item, index) => emails.indexOf(item) !== index);

        if (duplicates.length > 0) {
            console.log('\n!!! POTENTIAL DUPLICATE EMAILS FOUND !!!', [...new Set(duplicates)]);

            // Print details for duplicates
            duplicates.forEach(email => {
                const dupes = leads.filter(l => l.email === email);
                console.log(`\nDuplicate Group: ${email}`);
                dupes.forEach(d => {
                    console.log(`  - ${d.created_at} | ID: ${d.id} | Source: ${d.source}`);
                });
            });

        } else {
            console.log('\nNo duplicate emails found in top 20 recent leads.');
        }

    } else {
        console.log('No leads found.');
    }
}

checkRecentLeads();
