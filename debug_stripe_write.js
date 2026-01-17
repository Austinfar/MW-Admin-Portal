const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// 1. Read .env.local
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

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
    console.error('Missing credentials');
    console.log('URL:', url ? 'Found' : 'Missing');
    console.log('Key:', key ? 'Found' : 'Missing');
    process.exit(1);
}

console.log('Connecting to:', url);

const supabase = createClient(url, key, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function run() {
    const testId = 'debug_' + Date.now();
    console.log(`Attempting insert with ID: ${testId}`);

    const { data, error } = await supabase.from('payments').insert({
        stripe_payment_id: testId,
        amount: 1.00,
        status: 'succeeded',
        payment_date: new Date().toISOString(),
        product_name: 'Debug Test',
        created_at: new Date().toISOString()
    }).select();

    if (error) {
        console.error('INSERT ERROR:', error);
    } else {
        console.log('INSERT SUCCESS:', data);
    }
}

run();
