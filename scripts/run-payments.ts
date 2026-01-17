
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !STRIPE_SECRET_KEY) {
    console.error('Missing required environment variables.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const stripe = new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: '2024-12-18.acacia' as any, // Ignore version mismatch
    typescript: true,
});

async function repairAndProcess() {
    console.log('Starting repair process...');

    const sessionId = 'cs_test_a1LxedYL90uBKgf6gaCz1JFjKQuFALFYCQp1CAI1pOYzbIui3bdYGgb3ne';
    const scheduleId = '7f60c6ef-fe2e-4cda-9914-7714ea810717';

    try {
        // 1. Fetch Session Details
        console.log(`Fetching session ${sessionId}...`);
        const session = await stripe.checkout.sessions.retrieve(sessionId, {
            expand: ['setup_intent', 'payment_intent', 'payment_intent.payment_method']
        });

        if (session.status !== 'complete') {
            console.error('Session is not complete. Aborting.');
            return;
        }

        const email = session.customer_details?.email;
        if (!email) {
            console.error('No email found in session customer_details. Aborting.');
            return; // Or handle manually if you know the email
        }
        console.log(`Found email: ${email}`);

        let customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;

        // 2. Identify Payment Method
        let paymentMethodId: string | undefined;
        if (session.payment_intent && typeof session.payment_intent !== 'string') {
            const pm = session.payment_intent.payment_method;
            paymentMethodId = typeof pm === 'string' ? pm : pm?.id;
        }

        if (!paymentMethodId) {
            console.error('No payment method found on session payment intent.');
            return;
        }
        console.log(`Found Payment Method: ${paymentMethodId}`);


        // 3. Create Customer if needed
        if (!customerId) {
            console.log('No Customer ID found. Creating new Stripe Customer...');
            // Check if customer already exists to avoid dupes?
            const existing = await stripe.customers.list({ email: email, limit: 1 });
            if (existing.data.length > 0) {
                customerId = existing.data[0].id;
                console.log(`Found existing customer: ${customerId}`);
            } else {
                const newCustomer = await stripe.customers.create({
                    email: email,
                    name: session.customer_details?.name || undefined,
                });
                customerId = newCustomer.id;
                console.log(`Created new customer: ${customerId}`);
            }
        } else {
            console.log(`Using existing session customer: ${customerId}`);
        }

        // 4. Attach Payment Method to Customer
        console.log(`Attaching payment method ${paymentMethodId} to customer ${customerId}...`);
        try {
            await stripe.paymentMethods.attach(paymentMethodId, {
                customer: customerId,
            });
            console.log('Payment method attached.');
        } catch (e: any) {
            if (e.message.includes('already attached')) {
                console.log('Payment method already attached.');
            } else {
                throw e;
            }
        }

        // Set as default (optional but good for subscriptions/invoices)
        // await stripe.customers.update(customerId, {
        //     invoice_settings: { default_payment_method: paymentMethodId },
        // });

        // 5. Update Supabase
        console.log('Updating Supabase payment_schedules...');
        const { error: updateError } = await supabase
            .from('payment_schedules')
            .update({
                stripe_customer_id: customerId,
                stripe_payment_method_id: paymentMethodId,
                client_email: email, // Backfill email too
                status: 'active'     // Set status to active since it's paid
            })
            .eq('id', scheduleId);

        if (updateError) {
            console.error('Failed to update Supabase:', updateError);
            return;
        }
        console.log('Supabase updated.');

        // 6. Process the pending scheduled charge for this schedule
        console.log('Processing pending scheduled charges for this schedule...');
        const { data: charges } = await supabase
            .from('scheduled_charges')
            .select('*')
            .eq('schedule_id', scheduleId)
            .eq('status', 'pending'); // Retrieve all pending for this schedule

        if (charges && charges.length > 0) {
            for (const charge of charges) {
                // Double check date? Or just force process as requested.
                // The original cron check was due_date <= now.
                if (new Date(charge.due_date) <= new Date()) {
                    console.log(`Charge ${charge.id} ($${charge.amount / 100}) is due. Processing...`);

                    try {
                        const pi = await stripe.paymentIntents.create({
                            amount: charge.amount,
                            currency: 'usd',
                            customer: customerId,
                            payment_method: paymentMethodId,
                            off_session: true,
                            confirm: true,
                        });
                        console.log(`Success! PI: ${pi.id}`);

                        await supabase
                            .from('scheduled_charges')
                            .update({ status: 'paid', stripe_payment_intent_id: pi.id })
                            .eq('id', charge.id);

                    } catch (err: any) {
                        console.error(`Charge failed: ${err.message}`);
                    }
                } else {
                    console.log(`Charge ${charge.id} is NOT due yet (${charge.due_date}). Skipping.`);
                }
            }
        } else {
            console.log('No pending charges found for this schedule.');
        }


    } catch (e: any) {
        console.error('Repair failed:', e.message);
    }
}

repairAndProcess();
