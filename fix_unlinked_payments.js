const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');
const fs = require('fs');
const path = require('path');

// 1. Load Env
const envPath = path.resolve(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [k, v] = line.split('=');
    if (k && v) env[k.trim()] = v.trim();
});

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseKey = env['SUPABASE_SERVICE_ROLE_KEY'];
const stripeKey = env['STRIPE_SECRET_KEY'];

if (!stripeKey) {
    console.error('Missing STRIPE_SECRET_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const stripe = new Stripe(stripeKey);

async function run() {
    console.log('Starting Repair Job...');

    // 2. Get unique unlinked customer IDs
    const { data: unlinked } = await supabase
        .from('payments')
        .select('stripe_customer_id')
        .is('client_id', null)
        .neq('stripe_customer_id', null);

    const custIds = [...new Set(unlinked.map(p => p.stripe_customer_id))];
    console.log(`Found ${custIds.length} unique unlinked Stripe Customer IDs.`);

    // 3. Get all clients for matching
    const { data: clients } = await supabase.from('clients').select('id, email, name');
    console.log(`Loaded ${clients.length} clients from DB.`);

    let linkedCount = 0;
    let notFoundCount = 0;

    for (const custId of custIds) {
        try {
            // A. Fetch Customer from Stripe
            const customer = await stripe.customers.retrieve(custId);
            const email = customer.email;

            if (!email) {
                console.log(`[SKIP] Customer ${custId} has no email in Stripe.`);
                continue;
            }

            // B. Find Client in DB
            const client = clients.find(c => c.email && c.email.toLowerCase() === email.toLowerCase());

            if (client) {
                console.log(`[MATCH] ${custId} (${email}) -> Client: ${client.name}`);

                // C. Update Client (Link Stripe ID)
                await supabase.from('clients')
                    .update({ stripe_customer_id: custId })
                    .eq('id', client.id);

                // D. Update Payments (Link Client ID & Email)
                const { error } = await supabase.from('payments')
                    .update({
                        client_id: client.id,
                        client_email: email
                    })
                    .eq('stripe_customer_id', custId);

                if (error) console.error('Error updating payments:', error);

                linkedCount++;
            } else {
                console.log(`[NO_CLIENT] ${custId} (${email}) - No matching client in DB.`);
                notFoundCount++;
            }

        } catch (e) {
            console.error(`Error processing ${custId}:`, e.message);
        }
    }

    console.log('------------------------------------------------');
    console.log(`Repair Complete.`);
    console.log(`Successfully Linked: ${linkedCount} customers.`);
    console.log(`Still Unlinked (Missing Clients): ${notFoundCount} customers.`);
}

run();
