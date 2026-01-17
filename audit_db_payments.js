const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load env
const envPath = path.resolve(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
        const [k, ...vals] = trimmed.split('=');
        if (k) env[k.trim()] = vals.join('=').trim();
    }
});

const supabase = createClient(env['NEXT_PUBLIC_SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY']);

async function audit() {
    console.log('--- Auditing Payments Table ---');
    const { data, error } = await supabase
        .from('payments')
        .select('*')
        .limit(3)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error:', error);
        return;
    }

    if (data.length === 0) {
        console.log('No payments found.');
    } else {
        data.forEach((p, i) => {
            console.log(`\nPayment #${i + 1}:`);
            console.log(`ID: ${p.id}`);
            console.log(`Amount: ${p.amount} (Type: ${typeof p.amount})`);
            console.log(`Stripe ID: ${p.stripe_payment_id}`);
            console.log(`Client Email: ${p.client_email}`);
            console.log(`Client ID: ${p.client_id}`);
            console.log(`Status: ${p.status}`);
        });
    }
}

audit();
