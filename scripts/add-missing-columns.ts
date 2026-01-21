/**
 * Add missing columns for commission system
 * Run with: npx tsx scripts/add-missing-columns.ts
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkAndAddColumns() {
    console.log('🔍 Checking database schema...\n');

    // Check if columns exist by trying to select them
    const tests = [
        { table: 'clients', column: 'appointment_setter_id' },
        { table: 'clients', column: 'coach_history' },
        { table: 'leads', column: 'booked_by_user_id' },
        { table: 'commission_ledger', column: 'payroll_run_id' },
        { table: 'commission_ledger', column: 'split_role' },
        { table: 'payments', column: 'refund_amount' },
    ];

    const missing: string[] = [];

    for (const test of tests) {
        const { error } = await supabase
            .from(test.table)
            .select(test.column)
            .limit(1);

        if (error && error.message.includes('does not exist')) {
            missing.push(`${test.table}.${test.column}`);
            console.log(`❌ Missing: ${test.table}.${test.column}`);
        } else if (error) {
            console.log(`⚠️  ${test.table}.${test.column}: ${error.message}`);
        } else {
            console.log(`✅ Exists: ${test.table}.${test.column}`);
        }
    }

    // Check for payroll_runs table
    const { error: prError } = await supabase.from('payroll_runs').select('id').limit(1);
    if (prError && prError.message.includes('does not exist')) {
        missing.push('payroll_runs (table)');
        console.log(`❌ Missing: payroll_runs table`);
    } else if (prError) {
        console.log(`⚠️  payroll_runs: ${prError.message}`);
    } else {
        console.log(`✅ Exists: payroll_runs table`);
    }

    // Check for commission_adjustments table
    const { error: caError } = await supabase.from('commission_adjustments').select('id').limit(1);
    if (caError && caError.message.includes('does not exist')) {
        missing.push('commission_adjustments (table)');
        console.log(`❌ Missing: commission_adjustments table`);
    } else if (caError) {
        console.log(`⚠️  commission_adjustments: ${caError.message}`);
    } else {
        console.log(`✅ Exists: commission_adjustments table`);
    }

    if (missing.length > 0) {
        console.log('\n⚠️  MIGRATION NEEDED');
        console.log('The following schema changes are missing:');
        missing.forEach(m => console.log(`  - ${m}`));
        console.log('\nTo apply the migration, go to your Supabase Dashboard:');
        console.log('1. Go to SQL Editor');
        console.log('2. Copy the contents of: supabase/migrations/20260120_commission_system_v2.sql');
        console.log('3. Run the SQL');
        console.log('\nOr run: supabase db push (requires supabase login)');
    } else {
        console.log('\n✅ All schema changes are in place!');
    }

    return missing.length === 0;
}

checkAndAddColumns().catch(console.error);
