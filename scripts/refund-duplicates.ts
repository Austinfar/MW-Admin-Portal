
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

async function refundDuplicates() {
    const duplicates = [
        'pi_3SqeKyGNcbuTZPAa1PHGDmfz', // Created 18:35 (Most recent)
        'pi_3SqeG8GNcbuTZPAa1Ph6u0BA'  // Created 18:30 (Middle)
    ];
    // keeping pi_3SqeFrGNcbuTZPAa042L5206 (First one, 18:29) as the valid one

    for (const piId of duplicates) {
        console.log(`Refunding ${piId}...`);
        try {
            const refund = await stripe.refunds.create({
                payment_intent: piId,
                reason: 'duplicate',
            });
            console.log(`Success: ${refund.status}`);
        } catch (e: any) {
            console.error(`Error refunding ${piId}:`, e.message);
        }
    }
}

refundDuplicates();
