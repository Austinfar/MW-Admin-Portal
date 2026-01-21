import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkStripeCustomer(customerId: string) {
    console.log(`\nChecking Stripe customer: ${customerId}\n`);

    try {
        // Get customer details
        const customer = await stripe.customers.retrieve(customerId);
        console.log('Customer found in Stripe:');
        console.log(`  Email: ${(customer as Stripe.Customer).email}`);
        console.log(`  Name: ${(customer as Stripe.Customer).name}`);

        // Get all payment intents for this customer
        const paymentIntents = await stripe.paymentIntents.list({
            customer: customerId,
            limit: 100
        });

        console.log(`\n--- Payment Intents in Stripe: ${paymentIntents.data.length} ---`);
        for (const pi of paymentIntents.data) {
            console.log(`\n  ${pi.id}`);
            console.log(`    Amount: $${(pi.amount / 100).toFixed(2)} ${pi.currency.toUpperCase()}`);
            console.log(`    Status: ${pi.status}`);
            console.log(`    Created: ${new Date(pi.created * 1000).toISOString()}`);
            console.log(`    Description: ${pi.description || 'N/A'}`);

            // Check if this payment is in our database
            const { data: dbPayment } = await supabase
                .from('payments')
                .select('id, client_id')
                .eq('stripe_payment_id', pi.id)
                .single();

            if (dbPayment) {
                console.log(`    In DB: YES (client_id: ${dbPayment.client_id || 'NULL'})`);
            } else {
                console.log(`    In DB: NO - MISSING!`);
            }
        }

        // Also check charges (older API)
        const charges = await stripe.charges.list({
            customer: customerId,
            limit: 100
        });

        if (charges.data.length > 0) {
            console.log(`\n--- Charges in Stripe: ${charges.data.length} ---`);
            for (const charge of charges.data) {
                console.log(`\n  ${charge.id}`);
                console.log(`    Amount: $${(charge.amount / 100).toFixed(2)}`);
                console.log(`    Status: ${charge.status}`);
                console.log(`    Payment Intent: ${charge.payment_intent || 'N/A'}`);
            }
        }

        // Check invoices (for subscriptions)
        const invoices = await stripe.invoices.list({
            customer: customerId,
            limit: 100
        });

        if (invoices.data.length > 0) {
            console.log(`\n--- Invoices in Stripe: ${invoices.data.length} ---`);
            for (const inv of invoices.data) {
                console.log(`\n  ${inv.id}`);
                console.log(`    Amount: $${((inv.amount_paid || 0) / 100).toFixed(2)}`);
                console.log(`    Status: ${inv.status}`);
                console.log(`    Paid: ${inv.paid}`);
            }
        }

    } catch (error: any) {
        console.error('Error:', error.message);
    }
}

const customerId = process.argv[2] || 'cus_TpSaCdmFxgpkJg';
checkStripeCustomer(customerId).catch(console.error);
