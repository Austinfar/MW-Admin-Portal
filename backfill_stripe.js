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
    console.log('Starting Stripe History Backfill (3 Months)...');

    const daysBack = 365;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);
    // Convert to unix timestamp
    const createdGte = Math.floor(startDate.getTime() / 1000);

    console.log(`Fetching payments created on or after: ${startDate.toISOString()}`);

    let hasMore = true;
    let startingAfter = null;
    let totalProcessed = 0;
    let totalUpserted = 0;

    while (hasMore) {
        const params = {
            limit: 100,
            created: { gte: createdGte },
        };

        if (startingAfter) {
            params.starting_after = startingAfter;
        }

        const payments = await stripe.paymentIntents.list(params);

        if (payments.data.length === 0) {
            hasMore = false;
            break;
        }

        console.log(`Processing batch of ${payments.data.length}...`);

        for (const payment of payments.data) {
            if (payment.status !== 'succeeded') continue;

            totalProcessed++;

            const stripeCustomerId = typeof payment.customer === 'string'
                ? payment.customer
                : payment.customer?.id || null;

            let clientId = null;

            // Try to match by customer ID first
            if (stripeCustomerId) {
                const { data: client } = await supabase
                    .from('clients')
                    .select('id')
                    .eq('stripe_customer_id', stripeCustomerId)
                    .single();

                if (client) {
                    clientId = client.id;
                }
            }

            // Fall back to email match
            if (!clientId && payment.receipt_email) {
                const { data: client } = await supabase
                    .from('clients')
                    .select('id')
                    .ilike('email', payment.receipt_email)
                    .single();

                if (client) {
                    clientId = client.id;
                }
            }

            // Prepare Metadata for product name if description is missing
            // Sometimes product name is in metadata or we default to 'Stripe Payment'
            const productName = payment.description || 'Stripe Payment';

            // Upsert payment
            const { error } = await supabase.from('payments').upsert({
                stripe_payment_id: payment.id,
                amount: payment.amount / 100,
                currency: payment.currency,
                status: payment.status,
                payment_date: new Date(payment.created * 1000).toISOString(),
                client_email: payment.receipt_email ?? null,
                stripe_customer_id: stripeCustomerId,
                client_id: clientId,
                product_name: productName,
            }, {
                onConflict: 'stripe_payment_id'
            });

            if (error) {
                console.error(`Error saving payment ${payment.id}:`, error.message);
            } else {
                totalUpserted++;
            }
        }

        if (payments.has_more) {
            startingAfter = payments.data[payments.data.length - 1].id;
        } else {
            hasMore = false;
        }
    }

    console.log('------------------------------------------------');
    console.log(`Backfill Complete.`);
    console.log(`Processed: ${totalProcessed} successful payments.`);
    console.log(`Upserted to DB: ${totalUpserted}.`);
}

run();
