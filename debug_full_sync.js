const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');
const fs = require('fs');
const path = require('path');

// 1. Load Env
const envPath = path.resolve(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [k, v] = line.split('=');
    if (k && v) env[k.trim()] = v.trim();
});

const stripeKey = env['STRIPE_SECRET_KEY'];
const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseKey = env['SUPABASE_SERVICE_ROLE_KEY'];

if (!stripeKey || !supabaseUrl || !supabaseKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const stripe = new Stripe(stripeKey, { apiVersion: '2024-12-18.acacia' });
const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
    console.log('Starting full sync debug...');

    try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);

        console.log('Fetching payments since:', startDate.toISOString());

        const payments = await stripe.paymentIntents.list({
            created: { gte: Math.floor(startDate.getTime() / 1000) },
            limit: 5, // Just test 5
        });

        console.log(`Found ${payments.data.length} payments.`);

        for (const payment of payments.data) {
            console.log(`\nProcessing ${payment.id} (${payment.status})...`);

            if (payment.status !== 'succeeded') {
                console.log('Skipping non-succeeded status');
                continue;
            }

            const payload = {
                stripe_payment_id: payment.id,
                amount: payment.amount / 100,
                currency: payment.currency,
                status: payment.status,
                payment_date: new Date(payment.created * 1000).toISOString(),
                client_email: payment.receipt_email ?? null,
                stripe_customer_id: typeof payment.customer === 'string' ? payment.customer : payment.customer?.id || null,
                client_id: null, // Skipping client matching logic for simplicity, just want to test writes
                product_name: payment.description || 'Debug Sync Item',
            };

            console.log('Upsert Payload:', JSON.stringify(payload, null, 2));

            const { data, error } = await supabase.from('payments').upsert(payload).select();

            if (error) {
                console.error('❌ UPSERT FAILED:', JSON.stringify(error, null, 2));
            } else {
                console.log('✅ UPSERT SUCCESS:', data[0].id);
            }
        }

    } catch (e) {
        console.error('CRITICAL ERROR:', e);
    }
}

run();
