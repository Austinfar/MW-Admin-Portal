// Standalone script to populate missing emails in payments table
// Mocking the loaded env for the imported module if needed, 
// but since 'stripe-sync' uses 'createAdminClient' which reads process.env, 
// we must ensure env vars are loaded in this script process before import or execution.

// Actually, simpler to just use my existing pattern of `node -e` or `node script.js` that loads env first.
// I will replicate the env loading header I used in audit script.

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load env
const envPath = path.resolve(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
        const [k, ...vals] = trimmed.split('=');
        if (k) process.env[k.trim()] = vals.join('=').trim();
    }
});

// Now we can require the TS file? 
// No, node cannot run TS directly without ts-node.
// It is better to write a small JS script that does the logic directly 
// OR use ts-node if available. I'll stick to JS to be safe and avoid compilation/config issues.

// I will re-implement the specific sync logic in this JS script for guaranteed execution.
const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    console.log('--- Starting Email Backfill Sync ---');

    console.log('Fetching last 100 payments from Stripe...');
    const payments = await stripe.paymentIntents.list({
        limit: 100,
        expand: ['data.charges.data.billing_details'], // Try to expand if needed, though usually standard
    });

    console.log(`Found ${payments.data.length} payments.`);
    let updatedCount = 0;

    for (const payment of payments.data) {
        let email = payment.receipt_email;
        if (!email && payment.charges && payment.charges.data.length > 0) {
            email = payment.charges.data[0].billing_details?.email;
        }

        if (email) {
            // Update Supabase
            // We only update if client_email is null or we want to overwrite?
            // Let's overwite to be sure.
            const { error } = await supabase
                .from('payments')
                .update({ client_email: email })
                .eq('stripe_payment_id', payment.id);

            if (!error) {
                updatedCount++;
                process.stdout.write('.');
            } else {
                console.error(`\nFailed to update ${payment.id}: ${error.message}`);
            }
        }
    }

    console.log(`\n\nSync Complete. Updated ${updatedCount} payments with emails.`);
}

run();
