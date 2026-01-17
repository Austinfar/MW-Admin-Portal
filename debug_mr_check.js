const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
        const [k, ...vals] = trimmed.split('=');
        if (k && vals.length > 0) {
            env[k.trim()] = vals.join('=').trim();
        }
    }
});

const supabase = createClient(env['NEXT_PUBLIC_SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY']);

async function run() {
    const { data, error } = await supabase.from('subscriptions').select('status, amount, interval').limit(50);
    if (error) {
        console.error('Error:', error);
        return;
    }
    console.log(`Total rows fetched: ${data.length}`);

    const statusCounts = {};
    let totalActiveAmount = 0;

    data.forEach(s => {
        statusCounts[s.status] = (statusCounts[s.status] || 0) + 1;
        if (s.status === 'active' || s.status === 'trialing') {
            totalActiveAmount += s.amount;
        }
    });

    console.log('Status Counts (sample):', statusCounts);
    console.log('Active Monthly Revenue in Cents (sample total):', totalActiveAmount);
}

run();
