import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkClientPayments(clientName: string) {
    console.log(`\nChecking payments for client: ${clientName}\n`);

    // Find the client
    const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('id, name, email, stripe_customer_id')
        .ilike('name', `%${clientName}%`)
        .single();

    if (clientError || !client) {
        console.log('Client not found:', clientError?.message);
        return;
    }

    console.log('Client found:');
    console.log(`  ID: ${client.id}`);
    console.log(`  Name: ${client.name}`);
    console.log(`  Email: ${client.email}`);
    console.log(`  Stripe Customer ID: ${client.stripe_customer_id || 'NOT LINKED'}`);

    // Check payments linked by client_id
    const { data: clientIdPayments } = await supabase
        .from('payments')
        .select('*')
        .eq('client_id', client.id);

    console.log(`\n--- Payments linked by client_id: ${clientIdPayments?.length || 0} ---`);
    clientIdPayments?.forEach(p => {
        console.log(`  ${p.stripe_payment_id}`);
        console.log(`    Amount: $${p.amount} | Status: ${p.status}`);
        console.log(`    Date: ${p.payment_date}`);
        console.log(`    Email: ${p.client_email}`);
    });

    // Check payments by email
    if (client.email) {
        const { data: emailPayments } = await supabase
            .from('payments')
            .select('*')
            .eq('client_email', client.email);

        console.log(`\n--- Payments matching email (${client.email}): ${emailPayments?.length || 0} ---`);
        emailPayments?.forEach(p => {
            const linked = p.client_id === client.id ? 'LINKED' : p.client_id ? 'LINKED TO OTHER' : 'NOT LINKED';
            console.log(`  ${p.stripe_payment_id} - ${linked}`);
            console.log(`    Amount: $${p.amount} | Status: ${p.status}`);
        });
    }

    // Check payments by Stripe customer ID
    if (client.stripe_customer_id) {
        const { data: stripePayments } = await supabase
            .from('payments')
            .select('*')
            .eq('stripe_customer_id', client.stripe_customer_id);

        console.log(`\n--- Payments by Stripe customer ID: ${stripePayments?.length || 0} ---`);
        stripePayments?.forEach(p => {
            const linked = p.client_id === client.id ? 'LINKED' : p.client_id ? 'LINKED TO OTHER' : 'NOT LINKED';
            console.log(`  ${p.stripe_payment_id} - ${linked}`);
            console.log(`    Amount: $${p.amount} | Status: ${p.status}`);
        });
    }

    // Check all payments with this email or partial email match
    const { data: allEmailPayments } = await supabase
        .from('payments')
        .select('*')
        .ilike('client_email', `%${client.email?.split('@')[0]}%`);

    if (allEmailPayments && allEmailPayments.length > (clientIdPayments?.length || 0)) {
        console.log(`\n--- All payments with similar email: ${allEmailPayments?.length || 0} ---`);
        allEmailPayments?.forEach(p => {
            console.log(`  ${p.client_email} - $${p.amount} - client_id: ${p.client_id || 'NULL'}`);
        });
    }
}

const clientName = process.argv[2] || 'Michael Dantrassy';
checkClientPayments(clientName).catch(console.error);
