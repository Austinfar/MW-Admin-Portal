
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
    console.log('Fetching top 5 recent leads...');
    const { data: leads, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error fetching leads:', error);
        return;
    }

    if (leads && leads.length > 0) {
        leads.forEach((l, i) => {
            console.log(`#${i + 1} ID: ${l.id}`);
            console.log(`    Name: ${l.first_name} ${l.last_name}`);
            console.log(`    Email: ${l.email}`);
            console.log(`    Created: ${l.created_at}`);
            console.log(`    Source: ${l.source}`);
            console.log('-----------------------------------');
        });
    } else {
        console.log('No leads found.');
    }
}

checkRecentLeads();
