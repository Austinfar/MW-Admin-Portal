
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import Stripe from 'stripe';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

if (!STRIPE_SECRET_KEY) {
    console.error('Missing required environment variables.');
    process.exit(1);
}

const stripe = new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: '2024-12-18.acacia' as any,
    typescript: true,
});

async function checkRecentCharges() {
    const customerId = 'cus_TkuL752CHxxMWr';
    console.log(`Checking recent charges for ${customerId}...`);

    try {
        const paymentIntents = await stripe.paymentIntents.list({
            customer: customerId,
            limit: 5,
        });

        console.log(`Found ${paymentIntents.data.length} recent payment intents:`);
        paymentIntents.data.forEach(pi => {
            console.log(`- ID: ${pi.id}, Amount: ${pi.amount}, Status: ${pi.status}, Created: ${new Date(pi.created * 1000).toISOString()}, Desc: ${pi.description}`);
        });

    } catch (e: any) {
        console.error('Error fetching charges:', e.message);
    }
}

checkRecentCharges();
