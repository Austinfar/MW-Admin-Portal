
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

async function debugSessions() {
    console.log('Debugging sessions...');

    const sessionsData = [
        { id: 'cs_test_a1gpDW7k77tzUtc1cHWScUuFsSXHn97RquGt5Fp4sC5pwYlXmfdBVon9zh', scheduleId: '61dd8c2d-b0a8-4ca5-b961-5e9f52ce131f' },
        { id: 'cs_test_a12D5yu4q6rEttviL3vpqeefoW2JTomDREt8V1h48np89eZMrw14Qpnyra', scheduleId: '3ff29d36-1448-4436-8009-bb4d0e43442c' }
    ];

    for (const item of sessionsData) {
        console.log(`\n--- Session: ${item.id} ---`);
        try {
            const session = await stripe.checkout.sessions.retrieve(item.id, {
                expand: ['setup_intent', 'payment_intent', 'payment_intent.payment_method', 'line_items']
            });

            console.log('Status:', session.status);
            console.log('Payment Status:', session.payment_status);
            console.log('Mode:', session.mode);
            console.log('Customer:', session.customer);
            console.log('Payment Intent:', typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id);
            console.log('Setup Intent:', typeof session.setup_intent === 'string' ? session.setup_intent : session.setup_intent?.id);
            console.log('Customer Details:', session.customer_details);

            if (session.payment_intent && typeof session.payment_intent !== 'string') {
                console.log('PI Payment Method:', session.payment_intent.payment_method);
            }

        } catch (e: any) {
            console.error('Error fetching session:', e.message);
        }
    }
}

debugSessions();
