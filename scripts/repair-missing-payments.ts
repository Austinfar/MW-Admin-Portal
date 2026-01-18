
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
    apiVersion: '2024-12-18.acacia' as any,
    typescript: true,
});

async function repairMissingPayments() {
    console.log('Starting batch repair process...');

    // The 3 identified problematic schedules
    const targetScheduleIds = [
        '61dd8c2d-b0a8-4ca5-b961-5e9f52ce131f',
        '3ff29d36-1448-4436-8009-bb4d0e43442c',
        'decb559d-7f52-4665-8367-9da792857897'
    ];

    for (const scheduleId of targetScheduleIds) {
        console.log(`\n--- Processing Schedule: ${scheduleId} ---`);

        try {
            // 1. Get Schedule details including Session ID
            const { data: schedule, error: fetchError } = await supabase
                .from('payment_schedules')
                .select('*')
                .eq('id', scheduleId)
                .single();

            if (fetchError || !schedule) {
                console.error(`Failed to fetch schedule ${scheduleId}:`, fetchError);
                continue;
            }

            if (!schedule.stripe_session_id) {
                console.error(`No Stripe Session ID for schedule ${scheduleId}. Skipping.`);
                continue;
            }

            // 2. Retrieve Session from Stripe to get Customer and Payment Method
            console.log(`Fetching session ${schedule.stripe_session_id}...`);
            const session = await stripe.checkout.sessions.retrieve(schedule.stripe_session_id, {
                expand: ['setup_intent', 'payment_intent', 'payment_intent.payment_method']
            });

            // Extract Customer ID
            let customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;

            // Extract Payment Method ID
            let paymentMethodId: string | undefined;
            if (session.payment_intent && typeof session.payment_intent !== 'string') {
                const pm = session.payment_intent.payment_method;
                paymentMethodId = typeof pm === 'string' ? pm : pm?.id;
            }
            // Sometimes it might be in setup_intent if it was setup mode?
            if (!paymentMethodId && session.setup_intent && typeof session.setup_intent !== 'string') {
                const pm = session.setup_intent.payment_method;
                paymentMethodId = typeof pm === 'string' ? pm : pm?.id;
            }

            if (!customerId || !paymentMethodId) {
                console.error(`Missing Stripe info in session. Customer: ${customerId}, PM: ${paymentMethodId}`);
                // Try creating customer if missing like in previous script? 
                // For now, assuming session has it as they completed it.
                // If it was setup mode, session.customer might be null if not created? 
                // But these usually have customers.
                if (session.customer_details?.email && !customerId) {
                    console.log('Attempting to find/create customer by email...');
                    const email = session.customer_details.email;
                    const existing = await stripe.customers.list({ email, limit: 1 });
                    if (existing.data.length > 0) {
                        customerId = existing.data[0].id;
                    } else {
                        const newCust = await stripe.customers.create({ email, name: session.customer_details.name || undefined });
                        customerId = newCust.id;
                    }
                    console.log(`Resolved Customer ID: ${customerId}`);
                }
            }

            if (!customerId || !paymentMethodId) {
                console.error('Critical failure: Could not resolve Customer or Payment Method. Skipping.');
                continue;
            }

            console.log(`Resolved - Customer: ${customerId}, PM: ${paymentMethodId}`);

            // Attach PM if needed (safely)
            try {
                await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
            } catch (e: any) {
                if (!e.message.includes('already attached')) {
                    console.error('Error attaching PM:', e.message);
                }
            }

            // 3. Update Payment Schedule
            const { error: updateError } = await supabase
                .from('payment_schedules')
                .update({
                    stripe_customer_id: customerId,
                    stripe_payment_method_id: paymentMethodId,
                    status: 'active',
                    client_email: session.customer_details?.email // Ensure email is set
                })
                .eq('id', scheduleId);

            if (updateError) {
                console.error('Failed to update payment_schedules:', updateError);
                continue;
            }
            console.log('Updated payment_schedules in DB.');

            // 4. Process Pending Charges for this schedule
            const { data: charges } = await supabase
                .from('scheduled_charges')
                .select('*')
                .eq('schedule_id', scheduleId)
                .eq('status', 'pending');

            if (!charges || charges.length === 0) {
                console.log('No pending charges found.');
                continue;
            }

            for (const charge of charges) {
                // Check if it's due (or overdue)
                const dueDate = new Date(charge.due_date);
                const now = new Date();

                // Add a small buffer or just check if it's in the past
                if (dueDate <= now) {
                    console.log(`Processing overdue charge ${charge.id} for $${charge.amount / 100}...`);

                    try {
                        const pi = await stripe.paymentIntents.create({
                            amount: charge.amount,
                            currency: 'usd',
                            customer: customerId,
                            payment_method: paymentMethodId,
                            off_session: true,
                            confirm: true,
                        });

                        await supabase
                            .from('scheduled_charges')
                            .update({
                                status: 'paid',
                                stripe_payment_intent_id: pi.id
                            })
                            .eq('id', charge.id);

                        console.log(`SUCCESS: Charge paid. PI: ${pi.id}`);
                    } catch (chargeError: any) {
                        console.error(`Failed to charge: ${chargeError.message}`);
                    }
                } else {
                    console.log(`Charge ${charge.id} is pending but not due yet (${charge.due_date}).`);
                }
            }

        } catch (err: any) {
            console.error(`Error processing schedule ${scheduleId}:`, err);
        }
    }
    console.log('\nBatch repair complete.');
}

repairMissingPayments();
