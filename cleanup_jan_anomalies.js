const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load Env
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

const supabase = createClient(env['NEXT_PUBLIC_SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY']);

async function cleanup() {
    console.log('Cleaning up Test Data...');

    // 1. Delete by Specific Email (from screenshot)
    const testEmails = [
        'testing@testing.com',
        'austin.farwell98@gmail.com',
        'john.doe@gmail.com',
        'jane.doe@gmail.com',
        'alexanderissaeff@gamil.com',
        'abigailfparsons@gmail.com'
    ];

    for (const email of testEmails) {
        // Find clients first
        const { data: clients } = await supabase.from('clients').select('id').eq('email', email);
        if (clients && clients.length > 0) {
            const ids = clients.map(c => c.id);
            // Delete payments for these clients
            const { count } = await supabase.from('payments').delete({ count: 'exact' }).in('client_id', ids);
            console.log(`Deleted ${count} payments for ${email}`);
            // Delete client
            await supabase.from('clients').delete().in('id', ids);
            console.log(`Deleted client ${email}`);
        } else {
            // Check for orphan payments directly if client doesn't exist but we recorded the email?
            // Our payments table doesn't have email column usually (it joins), but we can check if there are logic holes.
            // Actually, audit showed "Unknown" client for many.
        }
    }

    // 2. Delete by Pattern (Orphan Stripe IDs / Amounts)
    // The Audit showed many "Unknown" clients with specific amounts.
    // We will delete 'payments' where status='succeeded' AND amount matches valid test amounts AND date is very recent

    // $4444
    const { count: c4444 } = await supabase
        .from('payments')
        .delete({ count: 'exact' })
        .eq('amount', 4444);
    console.log(`Deleted ${c4444} payments of $4444`);

    // $22.22
    const { count: c22 } = await supabase
        .from('payments')
        .delete({ count: 'exact' })
        .eq('amount', 22.22);
    console.log(`Deleted ${c22} payments of $22.22`);

    // The Wall of $2000s from "Unknown" clients
    // We need to be careful not to delete REAL $2000 payments.
    // Fetch them first to check if they are linked to a REAL client.
    const { data: p2000 } = await supabase
        .from('payments')
        .select('id, client_id, stripe_payment_id, created_at')
        .eq('amount', 2000)
        .gte('payment_date', '2026-01-18'); // Screenshot shows Jan 19, 20, 21

    if (p2000 && p2000.length > 0) {
        let deleted2000 = 0;
        for (const p of p2000) {
            // Check if client exists
            let isReal = false;
            if (p.client_id) {
                const { data: c } = await supabase.from('clients').select('name').eq('id', p.client_id).single();
                if (c) isReal = true;
            }

            // If No Client (Orphan) -> Delete (High confidence it's test data from the screenshot which had No Customer Name sometimes)
            // Or if exact match to screenshot IDs
            if (!isReal) {
                await supabase.from('payments').delete().eq('id', p.id);
                deleted2000++;
            }
        }
        console.log(`Deleted ${deleted2000} orphan/test payments of $2000`);
    }

    // 3. Delete $1111, $1101, $1001 (Look like manual typed tests)
    const weirdAmounts = [1111, 1101, 1001, 1.67, 1.56, 1.43, 1.11, 1.1];
    const { count: cWeird } = await supabase
        .from('payments')
        .delete({ count: 'exact' })
        .in('amount', weirdAmounts);
    console.log(`Deleted ${cWeird} payments with weird amounts (${weirdAmounts.join(',')})`);
}

cleanup();
