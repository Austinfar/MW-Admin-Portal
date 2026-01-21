import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('Missing env'); process.exit(1); }

const supabase = createClient(url, key);

async function checkData() {
    console.log('📊 Checking test data...\n');

    // Check test clients
    const { count: clientCount } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .like('email', '%test%');
    console.log(`Test Clients: ${clientCount}`);

    // Check test payments
    const { count: paymentCount } = await supabase
        .from('payments')
        .select('*', { count: 'exact', head: true })
        .like('stripe_payment_id', 'pi_test_%');
    console.log(`Test Payments: ${paymentCount}`);

    // Check commission ledger entries
    const { count: ledgerCount } = await supabase
        .from('commission_ledger')
        .select('*', { count: 'exact', head: true });
    console.log(`Commission Ledger Entries (total): ${ledgerCount}`);

    // Check adjustments
    const { count: adjCount } = await supabase
        .from('commission_adjustments')
        .select('*', { count: 'exact', head: true });
    console.log(`Adjustments: ${adjCount}`);

    // Check payroll runs
    const { count: runCount } = await supabase
        .from('payroll_runs')
        .select('*', { count: 'exact', head: true });
    console.log(`Payroll Runs: ${runCount}`);

    // Get sample ledger entries
    console.log('\n--- Sample Commission Entries ---');
    const { data: ledger } = await supabase
        .from('commission_ledger')
        .select('commission_amount, split_role, status')
        .limit(10);
    ledger?.forEach(e => console.log(`  $${Number(e.commission_amount).toFixed(2)} | ${e.split_role} | ${e.status}`));
}

checkData().catch(console.error);
