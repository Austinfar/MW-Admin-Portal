const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// 1. Load Env
const envPath = path.resolve(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...vals] = trimmed.split('=');
        if (key && vals.length > 0) {
            env[key.trim()] = vals.join('=').trim();
        }
    }
});

const url = env['NEXT_PUBLIC_SUPABASE_URL'];
const key = env['SUPABASE_SERVICE_ROLE_KEY'];

if (!url || !key) {
    console.error('Missing credentials');
    process.exit(1);
}

const supabase = createClient(url, key);

async function run() {
    console.log('Verifying Financials Fix Logic...');

    // 1. Find a payment that is unlinked (client_id is null) but has an email
    const { data: unlinkedPayment } = await supabase
        .from('payments')
        .select('client_email, stripe_customer_id')
        .is('client_id', null)
        .not('client_email', 'is', null)
        .limit(1)
        .single();

    let targetClients = [];

    if (unlinkedPayment) {
        console.log(`Found unlinked payment for email: ${unlinkedPayment.client_email}`);
        const { data: client } = await supabase
            .from('clients')
            .select('*')
            .ilike('email', unlinkedPayment.client_email)
            .single();

        if (client) {
            console.log(`Found matching client: ${client.name}`);
            targetClients.push(client);
        } else {
            console.log('Could not find client for that email.');
        }
    } else {
        console.log('No unlinked payments with email found. checking by stripe_customer_id...');
        const { data: unlinkedPayment2 } = await supabase
            .from('payments')
            .select('client_email, stripe_customer_id')
            .is('client_id', null)
            .not('stripe_customer_id', 'is', null)
            .limit(1)
            .single();

        if (unlinkedPayment2) {
            console.log(`Found unlinked payment for StripeID: ${unlinkedPayment2.stripe_customer_id}`);
            const { data: client } = await supabase
                .from('clients')
                .select('*')
                .eq('stripe_customer_id', unlinkedPayment2.stripe_customer_id)
                .single();
            if (client) targetClients.push(client);
        }
    }

    if (targetClients.length === 0) {
        console.log('Could not find a specific "broken" case to test automatically.');
        console.log('Falling back to random check.');
        const { data: clients } = await supabase
            .from('clients')
            .select('*')
            .not('stripe_customer_id', 'is', null)
            .limit(5);
        targetClients = clients || [];
    }

    console.log(`Testing with ${targetClients.length} clients...`);

    for (const client of targetClients) {
        console.log(`\nChecking Client: ${client.name} (${client.email})`);

        // Old Logic: Only Client ID
        const { data: oldData } = await supabase
            .from('payments')
            .select('*')
            .eq('client_id', client.id);

        const oldCount = oldData ? oldData.length : 0;

        // New Logic: OR Query
        const conditions = [`client_id.eq.${client.id}`];
        if (client.email) conditions.push(`client_email.ilike.${client.email}`);
        if (client.stripe_customer_id) conditions.push(`stripe_customer_id.eq.${client.stripe_customer_id}`);

        const { data: newData, error } = await supabase
            .from('payments')
            .select('*')
            .or(conditions.join(','));

        if (error) {
            console.error('Error in new query:', error);
            continue;
        }

        const newCount = newData ? newData.length : 0;

        console.log(`  Old Method (Client ID only): ${oldCount} payments`);
        console.log(`  New Method (ID OR Email OR StripeID): ${newCount} payments`);

        if (newCount > oldCount) {
            console.log('  SUCCESS: New method found MORE payments!');
        } else {
            console.log('  SAME: Counts are identical.');
        }
    }
}

run();
