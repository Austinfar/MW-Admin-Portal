const Stripe = require('stripe');
const fs = require('fs');
const path = require('path');

// 1. Read .env.local to get the key directly
const envPath = path.resolve(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
let stripeKey = '';

const lines = envContent.split('\n');
for (const line of lines) {
    if (line.trim().startsWith('STRIPE_SECRET_KEY=')) {
        stripeKey = line.split('=')[1].trim();
        break;
    }
}

if (!stripeKey) {
    console.error('Could not find STRIPE_SECRET_KEY in .env.local');
    process.exit(1);
}

console.log('Using Stripe Key:', stripeKey.slice(0, 8) + '...');

const stripe = new Stripe(stripeKey, {
    apiVersion: '2024-12-18.acacia', // Matches package default or what's in lib
});

async function run() {
    try {
        console.log('Fetching last 10 PaymentIntents...');
        const payments = await stripe.paymentIntents.list({
            limit: 10,
        });

        console.log(`Found ${payments.data.length} payments.`);

        if (payments.data.length > 0) {
            console.log('First payment sample:', JSON.stringify({
                id: payments.data[0].id,
                amount: payments.data[0].amount,
                status: payments.data[0].status,
                created: new Date(payments.data[0].created * 1000).toISOString(),
                customer: payments.data[0].customer
            }, null, 2));
        } else {
            // Check balance to see if account is actually empty or accessible
            try {
                const balance = await stripe.balance.retrieve();
                console.log('Balance check successful:', balance.available);
            } catch (e) {
                console.log('Balance check failed:', e.message);
            }
        }

    } catch (error) {
        console.error('Stripe Fetch Error:', error.message);
    }
}

run();
