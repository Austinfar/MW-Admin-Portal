const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [k, v] = line.split('=');
    if (k && v) env[k.trim()] = v.trim();
});

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseKey = env['SUPABASE_SERVICE_ROLE_KEY'];

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log('Finding unlinked payments...');

    // 1. Fetch unlinked payments
    const { data: unlinked, error: pError } = await supabase
        .from('payments')
        .select('*')
        .is('client_id', null)
        .eq('status', 'succeeded');

    if (pError) return console.error(pError);

    console.log(`Found ${unlinked.length} unlinked successful payments.`);

    // 2. Inspect a few
    if (unlinked.length > 0) {
        console.log('\nSample Unlinked Payments:');
        unlinked.slice(0, 5).forEach(p => {
            console.log(`ID: ${p.id} | Amount: ${p.amount} | Email: ${p.client_email} | CustID: ${p.stripe_customer_id}`);
        });
    }

    // 3. Unique Customer IDs
    const custIds = [...new Set(unlinked.map(p => p.stripe_customer_id).filter(Boolean))];
    console.log(`\nUnique Stripe Customer IDs involved: ${custIds.length}`);
    console.log('Sample IDs:', custIds.slice(0, 5));
}

run();
