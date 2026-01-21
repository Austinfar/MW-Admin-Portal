import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';
import * as readline from 'readline';

config({ path: resolve(process.cwd(), '.env.local') });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(url, key);

function isTestEmail(email: string | null): boolean {
    if (!email) return false;
    const emailLower = email.toLowerCase();
    return emailLower.endsWith('@example.com') || emailLower.includes('test');
}

async function askConfirmation(question: string): Promise<boolean> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
        });
    });
}

async function findTestClientIds(): Promise<string[]> {
    const clientIds = new Set<string>();

    const { data: exampleClients } = await supabase
        .from('clients')
        .select('id')
        .like('email', '%@example.com');

    exampleClients?.forEach(c => clientIds.add(c.id));

    const { data: testClients } = await supabase
        .from('clients')
        .select('id')
        .ilike('email', '%test%');

    testClients?.forEach(c => clientIds.add(c.id));

    return Array.from(clientIds);
}

async function findTestLeadIds(): Promise<string[]> {
    const { data: leads } = await supabase
        .from('leads')
        .select('id, email');

    return leads?.filter(l => isTestEmail(l.email)).map(l => l.id) || [];
}

async function findTestPaymentIds(clientIds: string[]): Promise<string[]> {
    const paymentIds = new Set<string>();

    // Payments linked to test clients
    if (clientIds.length > 0) {
        const { data: clientPayments } = await supabase
            .from('payments')
            .select('id')
            .in('client_id', clientIds);

        clientPayments?.forEach(p => paymentIds.add(p.id));
    }

    // Payments with test Stripe IDs
    const { data: testPayments } = await supabase
        .from('payments')
        .select('id')
        .like('stripe_payment_id', 'pi_test_%');

    testPayments?.forEach(p => paymentIds.add(p.id));

    return Array.from(paymentIds);
}

async function deleteInOrder(clientIds: string[], leadIds: string[], paymentIds: string[]) {
    const results: { table: string; deleted: number; error?: string }[] = [];

    // 1. Delete commission ledger entries (by client_id or payment_id)
    console.log('\n1. Deleting commission_ledger entries...');
    if (clientIds.length > 0 || paymentIds.length > 0) {
        // Delete by client_id
        if (clientIds.length > 0) {
            const { error, count } = await supabase
                .from('commission_ledger')
                .delete({ count: 'exact' })
                .in('client_id', clientIds);

            if (error) {
                results.push({ table: 'commission_ledger (by client)', deleted: 0, error: error.message });
            } else {
                results.push({ table: 'commission_ledger (by client)', deleted: count || 0 });
            }
        }

        // Delete by payment_id
        if (paymentIds.length > 0) {
            const { error, count } = await supabase
                .from('commission_ledger')
                .delete({ count: 'exact' })
                .in('payment_id', paymentIds);

            if (error) {
                results.push({ table: 'commission_ledger (by payment)', deleted: 0, error: error.message });
            } else {
                results.push({ table: 'commission_ledger (by payment)', deleted: count || 0 });
            }
        }
    } else {
        results.push({ table: 'commission_ledger', deleted: 0 });
    }

    // 2. Delete activity_logs (by client_id or lead_id)
    console.log('2. Deleting activity_logs...');
    if (clientIds.length > 0) {
        const { error, count } = await supabase
            .from('activity_logs')
            .delete({ count: 'exact' })
            .in('client_id', clientIds);

        if (error) {
            results.push({ table: 'activity_logs (by client)', deleted: 0, error: error.message });
        } else {
            results.push({ table: 'activity_logs (by client)', deleted: count || 0 });
        }
    }

    if (leadIds.length > 0) {
        const { error, count } = await supabase
            .from('activity_logs')
            .delete({ count: 'exact' })
            .in('lead_id', leadIds);

        if (error) {
            results.push({ table: 'activity_logs (by lead)', deleted: 0, error: error.message });
        } else {
            results.push({ table: 'activity_logs (by lead)', deleted: count || 0 });
        }
    }

    // 3. Delete follow_up_tasks (by lead_id)
    console.log('3. Deleting follow_up_tasks...');
    if (leadIds.length > 0) {
        const { error, count } = await supabase
            .from('follow_up_tasks')
            .delete({ count: 'exact' })
            .in('lead_id', leadIds);

        if (error) {
            results.push({ table: 'follow_up_tasks', deleted: 0, error: error.message });
        } else {
            results.push({ table: 'follow_up_tasks', deleted: count || 0 });
        }
    } else {
        results.push({ table: 'follow_up_tasks', deleted: 0 });
    }

    // 4. Delete onboarding_tasks (by client_id)
    console.log('4. Deleting onboarding_tasks...');
    if (clientIds.length > 0) {
        const { error, count } = await supabase
            .from('onboarding_tasks')
            .delete({ count: 'exact' })
            .in('client_id', clientIds);

        if (error) {
            results.push({ table: 'onboarding_tasks', deleted: 0, error: error.message });
        } else {
            results.push({ table: 'onboarding_tasks', deleted: count || 0 });
        }
    } else {
        results.push({ table: 'onboarding_tasks', deleted: 0 });
    }

    // 5. Delete payments
    console.log('5. Deleting payments...');
    if (paymentIds.length > 0) {
        const { error, count } = await supabase
            .from('payments')
            .delete({ count: 'exact' })
            .in('id', paymentIds);

        if (error) {
            results.push({ table: 'payments', deleted: 0, error: error.message });
        } else {
            results.push({ table: 'payments', deleted: count || 0 });
        }
    } else {
        results.push({ table: 'payments', deleted: 0 });
    }

    // 6. Delete leads
    console.log('6. Deleting leads...');
    if (leadIds.length > 0) {
        const { error, count } = await supabase
            .from('leads')
            .delete({ count: 'exact' })
            .in('id', leadIds);

        if (error) {
            results.push({ table: 'leads', deleted: 0, error: error.message });
        } else {
            results.push({ table: 'leads', deleted: count || 0 });
        }
    } else {
        results.push({ table: 'leads', deleted: 0 });
    }

    // 7. Delete clients
    console.log('7. Deleting clients...');
    if (clientIds.length > 0) {
        const { error, count } = await supabase
            .from('clients')
            .delete({ count: 'exact' })
            .in('id', clientIds);

        if (error) {
            results.push({ table: 'clients', deleted: 0, error: error.message });
        } else {
            results.push({ table: 'clients', deleted: count || 0 });
        }
    } else {
        results.push({ table: 'clients', deleted: 0 });
    }

    return results;
}

async function main() {
    console.log('='.repeat(70));
    console.log('  TEST DATA DELETION SCRIPT');
    console.log('  WARNING: This will permanently delete data!');
    console.log('='.repeat(70));

    try {
        // Find test data
        console.log('\nFinding test data...');
        const clientIds = await findTestClientIds();
        const leadIds = await findTestLeadIds();
        const paymentIds = await findTestPaymentIds(clientIds);

        console.log(`\nFound:`);
        console.log(`  - ${clientIds.length} test clients`);
        console.log(`  - ${leadIds.length} test leads`);
        console.log(`  - ${paymentIds.length} test payments`);

        if (clientIds.length === 0 && leadIds.length === 0 && paymentIds.length === 0) {
            console.log('\nNo test data found. Nothing to delete.');
            return;
        }

        // Show what will be deleted
        console.log('\nThe following will be deleted:');
        console.log('  - Commission ledger entries linked to test clients/payments');
        console.log('  - Activity logs linked to test clients/leads');
        console.log('  - Follow-up tasks linked to test leads');
        console.log('  - Onboarding tasks linked to test clients');
        console.log('  - Payments linked to test clients or with test Stripe IDs');
        console.log('  - Test leads');
        console.log('  - Test clients');

        // Ask for confirmation
        const confirmed = await askConfirmation('\nProceed with deletion? (y/n): ');

        if (!confirmed) {
            console.log('\nDeletion cancelled.');
            return;
        }

        // Perform deletion
        console.log('\nStarting deletion...');
        const results = await deleteInOrder(clientIds, leadIds, paymentIds);

        // Print results
        console.log('\n' + '='.repeat(70));
        console.log('  DELETION RESULTS');
        console.log('='.repeat(70));

        let hasErrors = false;
        for (const result of results) {
            if (result.error) {
                console.log(`  ${result.table}: ERROR - ${result.error}`);
                hasErrors = true;
            } else {
                console.log(`  ${result.table}: ${result.deleted} deleted`);
            }
        }

        if (hasErrors) {
            console.log('\nSome deletions failed. Check errors above.');
        } else {
            console.log('\nAll test data deleted successfully!');
        }

        // Verify
        console.log('\n' + '='.repeat(70));
        console.log('  VERIFICATION');
        console.log('='.repeat(70));

        const { count: remainingClients } = await supabase
            .from('clients')
            .select('*', { count: 'exact', head: true })
            .or('email.ilike.%test%,email.like.%@example.com');

        const { count: remainingPayments } = await supabase
            .from('payments')
            .select('*', { count: 'exact', head: true })
            .like('stripe_payment_id', 'pi_test_%');

        console.log(`  Remaining test clients: ${remainingClients}`);
        console.log(`  Remaining test payments: ${remainingPayments}`);

    } catch (error) {
        console.error('Error during deletion:', error);
        process.exit(1);
    }
}

main();
