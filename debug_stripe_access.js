const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');
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

const stripe = new Stripe(env['STRIPE_SECRET_KEY']);

async function debugStripe() {
    console.log(`Using Key: ${env['STRIPE_SECRET_KEY'].substring(0, 10)}...`);

    const targetId = 'sub_1QgyLZGNcbuTZPAavJzv3wgq'; // Jeremy Freedman
    console.log(`\n1. Checking specific subscription: ${targetId}`);
    try {
        const sub = await stripe.subscriptions.retrieve(targetId);
        console.log(`FOUND! Status: ${sub.status}. Amount (cents): ${sub.items.data[0].price.unit_amount}. Interval Count: ${sub.items.data[0].price.recurring.interval_count}`);
    } catch (e) {
        console.log(`NOT FOUND. Error: ${e.message}`);
    }

    console.log(`\n2. Listing first 5 subscriptions from this Account:`);
    try {
        const list = await stripe.subscriptions.list({ limit: 5 });
        console.log(`Total returned: ${list.data.length}`);
        list.data.forEach(s => {
            console.log(`- ${s.id}: ${s.items.data[0].price.unit_amount} cents (${s.status})`);
        });
    } catch (e) {
        console.log(`List Error: ${e.message}`);
    }
}

debugStripe();
