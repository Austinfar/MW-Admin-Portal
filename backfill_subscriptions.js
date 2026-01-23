const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');
const fs = require('fs');
const path = require('path');

// 1. Load Env
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

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseKey = env['SUPABASE_SERVICE_ROLE_KEY'];
const stripeKey = env['STRIPE_SECRET_KEY'];

if (!stripeKey || !supabaseUrl || !supabaseKey) {
    console.error('Missing credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const stripe = new Stripe(stripeKey);

async function run() {
    console.log('Starting Stripe Subscription Backfill...');

    let hasMore = true;
    let startingAfter = undefined;
    let totalProcessed = 0;

    while (hasMore) {
        const subscriptions = await stripe.subscriptions.list({
            limit: 100,
            status: 'all',
            expand: ['data.customer'],
            starting_after: startingAfter
        });

        if (subscriptions.data.length === 0) {
            hasMore = false;
            break;
        }

        console.log(`Processing batch of ${subscriptions.data.length}...`);

        for (const sub of subscriptions.data) {
            totalProcessed++;
            const stripeCustomerId = typeof sub.customer === 'string'
                ? sub.customer
                : sub.customer.id;

            const { error } = await supabase.from('subscriptions').upsert({
                stripe_subscription_id: sub.id,
                stripe_customer_id: stripeCustomerId,
                status: sub.status,
                amount: (sub.items.data[0]?.price?.unit_amount || 0) / 100, // Convert cents to dollars
                currency: sub.currency,
                interval: sub.items.data[0]?.price?.recurring?.interval || 'month',
                interval_count: sub.items.data[0]?.price?.recurring?.interval_count || 1,
                current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
                cancel_at_period_end: sub.cancel_at_period_end,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'stripe_subscription_id'
            });

            if (error) {
                console.error(`Error saving subscription ${sub.id}:`, error.message);
            }
        }

        if (subscriptions.has_more) {
            startingAfter = subscriptions.data[subscriptions.data.length - 1].id;
        } else {
            hasMore = false;
        }
    }

    console.log('------------------------------------------------');
    console.log(`Backfill Complete.`);
    console.log(`Processed: ${totalProcessed} subscriptions.`);
}

run();
