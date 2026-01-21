import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('Missing env'); process.exit(1); }

const supabase = createClient(url, key);

async function check() {
    console.log('📋 Checking Payroll Runs...\n');

    // Get all payroll runs
    const { data: runs, error } = await supabase
        .from('payroll_runs')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching payroll runs:', error.message);
        return;
    }

    console.log(`Found ${runs?.length || 0} payroll runs:\n`);

    if (runs && runs.length > 0) {
        for (const run of runs) {
            console.log(`ID: ${run.id}`);
            console.log(`  Period: ${run.period_start} to ${run.period_end}`);
            console.log(`  Payout Date: ${run.payout_date}`);
            console.log(`  Status: ${run.status}`);
            console.log(`  Total Commission: $${run.total_commission}`);
            console.log(`  Total Adjustments: $${run.total_adjustments}`);
            console.log(`  Total Payout: $${run.total_payout}`);
            console.log(`  Transaction Count: ${run.transaction_count}`);
            console.log(`  Created By: ${run.created_by}`);
            console.log(`  Created At: ${run.created_at}`);
            console.log('');
        }
    } else {
        console.log('No payroll runs found.');
    }

    // Check commission ledger entries linked to runs
    const { data: linkedEntries } = await supabase
        .from('commission_ledger')
        .select('id, payroll_run_id')
        .not('payroll_run_id', 'is', null);

    console.log(`\nCommission entries linked to payroll runs: ${linkedEntries?.length || 0}`);
}

check().catch(console.error);
