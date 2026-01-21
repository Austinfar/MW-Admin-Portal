import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(url, key);

interface TestClient {
    id: string;
    email: string;
    name: string;
    matchReason: string;
}

interface TestLead {
    id: string;
    email: string;
    name: string;
    matchReason: string;
}

interface TestPayment {
    id: string;
    stripe_payment_id: string;
    client_id: string | null;
    client_email: string | null;
    amount: number;
    matchReason: string;
}

function isTestEmail(email: string | null): { isTest: boolean; reason: string } {
    if (!email) return { isTest: false, reason: '' };

    const emailLower = email.toLowerCase();

    if (emailLower.endsWith('@example.com')) {
        return { isTest: true, reason: 'Email ends with @example.com' };
    }

    if (emailLower.includes('test')) {
        return { isTest: true, reason: 'Email contains "test"' };
    }

    return { isTest: false, reason: '' };
}

async function findTestClients(): Promise<TestClient[]> {
    const clientMap = new Map<string, TestClient>();

    // Query 1: Clients with @example.com emails
    const { data: exampleClients, error: e1 } = await supabase
        .from('clients')
        .select('id, email, name')
        .like('email', '%@example.com');

    if (e1) console.error('Error querying example.com clients:', e1.message);

    exampleClients?.forEach(c => {
        clientMap.set(c.id, {
            id: c.id,
            email: c.email || '',
            name: c.name || 'Unknown',
            matchReason: 'Email ends with @example.com'
        });
    });

    // Query 2: Clients with 'test' in email (case-insensitive)
    const { data: testClients, error: e2 } = await supabase
        .from('clients')
        .select('id, email, name')
        .ilike('email', '%test%');

    if (e2) console.error('Error querying test clients:', e2.message);

    testClients?.forEach(c => {
        if (!clientMap.has(c.id)) {
            clientMap.set(c.id, {
                id: c.id,
                email: c.email || '',
                name: c.name || 'Unknown',
                matchReason: 'Email contains "test"'
            });
        }
    });

    return Array.from(clientMap.values());
}

async function findTestLeads(): Promise<TestLead[]> {
    const leadMap = new Map<string, TestLead>();

    // Query 1: Leads with @example.com emails
    const { data: exampleLeads, error: e1 } = await supabase
        .from('leads')
        .select('id, email, first_name, last_name');

    if (e1) console.error('Error querying leads:', e1.message);

    exampleLeads?.forEach(l => {
        const check = isTestEmail(l.email);
        if (check.isTest) {
            leadMap.set(l.id, {
                id: l.id,
                email: l.email || '',
                name: `${l.first_name || ''} ${l.last_name || ''}`.trim() || 'Unknown',
                matchReason: check.reason
            });
        }
    });

    return Array.from(leadMap.values());
}

async function findTestPayments(testClientIds: string[]): Promise<{ linkedPayments: TestPayment[]; orphanedPayments: TestPayment[] }> {
    const linkedPayments: TestPayment[] = [];
    const orphanedPayments: TestPayment[] = [];

    // Payments linked to test clients
    if (testClientIds.length > 0) {
        const { data: clientPayments, error: e1 } = await supabase
            .from('payments')
            .select('id, stripe_payment_id, client_id, client_email, amount')
            .in('client_id', testClientIds);

        if (e1) console.error('Error querying client payments:', e1.message);

        clientPayments?.forEach(p => {
            linkedPayments.push({
                id: p.id,
                stripe_payment_id: p.stripe_payment_id || '',
                client_id: p.client_id,
                client_email: p.client_email,
                amount: p.amount || 0,
                matchReason: 'Linked to test client'
            });
        });
    }

    // Payments with test Stripe IDs (might not be linked to test clients)
    const { data: testStripePayments, error: e2 } = await supabase
        .from('payments')
        .select('id, stripe_payment_id, client_id, client_email, amount')
        .like('stripe_payment_id', 'pi_test_%');

    if (e2) console.error('Error querying test stripe payments:', e2.message);

    testStripePayments?.forEach(p => {
        // Check if already in linkedPayments
        if (!linkedPayments.find(lp => lp.id === p.id)) {
            orphanedPayments.push({
                id: p.id,
                stripe_payment_id: p.stripe_payment_id || '',
                client_id: p.client_id,
                client_email: p.client_email,
                amount: p.amount || 0,
                matchReason: 'Stripe ID starts with pi_test_'
            });
        }
    });

    return { linkedPayments, orphanedPayments };
}

async function findRelatedRecords(clientIds: string[], leadIds: string[], paymentIds: string[]) {
    const results: {
        commissionLedger: { id: string; payment_id: string; user_id: string; commission_amount: number }[];
        activityLogs: { id: string; client_id: string | null; lead_id: string | null }[];
        followUpTasks: { id: string; lead_id: string }[];
        onboardingTasks: { id: string; client_id: string }[];
        adjustments: { id: string; payroll_run_id: string; amount: number }[];
    } = {
        commissionLedger: [],
        activityLogs: [],
        followUpTasks: [],
        onboardingTasks: [],
        adjustments: []
    };

    // Commission ledger entries linked to test clients or payments
    if (clientIds.length > 0) {
        const { data: clientCommissions, error } = await supabase
            .from('commission_ledger')
            .select('id, payment_id, user_id, commission_amount')
            .in('client_id', clientIds);

        if (error) console.error('Error querying commission ledger by client:', error.message);
        if (clientCommissions) results.commissionLedger.push(...clientCommissions);
    }

    if (paymentIds.length > 0) {
        const { data: paymentCommissions, error } = await supabase
            .from('commission_ledger')
            .select('id, payment_id, user_id, commission_amount')
            .in('payment_id', paymentIds);

        if (error) console.error('Error querying commission ledger by payment:', error.message);

        // Dedupe
        paymentCommissions?.forEach(pc => {
            if (!results.commissionLedger.find(c => c.id === pc.id)) {
                results.commissionLedger.push(pc);
            }
        });
    }

    // Activity logs
    if (clientIds.length > 0 || leadIds.length > 0) {
        let query = supabase.from('activity_logs').select('id, client_id, lead_id');

        if (clientIds.length > 0 && leadIds.length > 0) {
            query = query.or(`client_id.in.(${clientIds.join(',')}),lead_id.in.(${leadIds.join(',')})`);
        } else if (clientIds.length > 0) {
            query = query.in('client_id', clientIds);
        } else if (leadIds.length > 0) {
            query = query.in('lead_id', leadIds);
        }

        const { data, error } = await query;
        if (error) console.error('Error querying activity logs:', error.message);
        if (data) results.activityLogs = data;
    }

    // Follow-up tasks
    if (leadIds.length > 0) {
        const { data, error } = await supabase
            .from('follow_up_tasks')
            .select('id, lead_id')
            .in('lead_id', leadIds);

        if (error) console.error('Error querying follow-up tasks:', error.message);
        if (data) results.followUpTasks = data;
    }

    // Onboarding tasks
    if (clientIds.length > 0) {
        const { data, error } = await supabase
            .from('onboarding_tasks')
            .select('id, client_id')
            .in('client_id', clientIds);

        if (error) console.error('Error querying onboarding tasks:', error.message);
        if (data) results.onboardingTasks = data;
    }

    // Get affected payroll runs from commission ledger
    const payrollRunIds = [...new Set(results.commissionLedger.map(c => (c as any).payroll_run_id).filter(Boolean))];

    if (payrollRunIds.length > 0) {
        const { data, error } = await supabase
            .from('commission_adjustments')
            .select('id, payroll_run_id, amount')
            .in('payroll_run_id', payrollRunIds);

        if (error) console.error('Error querying adjustments:', error.message);
        if (data) results.adjustments = data;
    }

    return results;
}

async function getPayrollRunsInfo(commissionLedgerIds: string[]) {
    if (commissionLedgerIds.length === 0) return [];

    // Get payroll_run_ids from commission ledger
    const { data: ledgerWithRuns, error: e1 } = await supabase
        .from('commission_ledger')
        .select('payroll_run_id')
        .in('id', commissionLedgerIds)
        .not('payroll_run_id', 'is', null);

    if (e1) console.error('Error getting payroll runs from ledger:', e1.message);

    const runIds = [...new Set(ledgerWithRuns?.map(l => l.payroll_run_id).filter(Boolean) || [])];

    if (runIds.length === 0) return [];

    const { data: runs, error: e2 } = await supabase
        .from('payroll_runs')
        .select('id, period_start, period_end, status, total_commission')
        .in('id', runIds);

    if (e2) console.error('Error getting payroll run details:', e2.message);

    return runs || [];
}

async function main() {
    console.log('='.repeat(70));
    console.log('  TEST DATA IDENTIFICATION REPORT');
    console.log('  Generated:', new Date().toISOString());
    console.log('='.repeat(70));

    try {
        // Find test entities
        console.log('\nScanning for test data...\n');

        const testClients = await findTestClients();
        const testLeads = await findTestLeads();

        const clientIds = testClients.map(c => c.id);
        const leadIds = testLeads.map(l => l.id);

        // Find payments
        const { linkedPayments, orphanedPayments } = await findTestPayments(clientIds);
        const allTestPaymentIds = [...linkedPayments, ...orphanedPayments].map(p => p.id);

        // Find related records
        const related = await findRelatedRecords(clientIds, leadIds, allTestPaymentIds);

        // Get affected payroll runs
        const affectedPayrollRuns = await getPayrollRunsInfo(related.commissionLedger.map(c => c.id));

        // Print Summary
        console.log('SUMMARY');
        console.log('-'.repeat(40));
        console.log(`  Test Clients:              ${testClients.length}`);
        console.log(`  Test Leads:                ${testLeads.length}`);
        console.log(`  Test Payments (linked):    ${linkedPayments.length}`);
        console.log(`  Test Payments (orphaned):  ${orphanedPayments.length}`);
        console.log(`  Commission Ledger Entries: ${related.commissionLedger.length}`);
        console.log(`  Commission Adjustments:    ${related.adjustments.length}`);
        console.log(`  Activity Logs:             ${related.activityLogs.length}`);
        console.log(`  Follow-up Tasks:           ${related.followUpTasks.length}`);
        console.log(`  Onboarding Tasks:          ${related.onboardingTasks.length}`);
        console.log(`  Affected Payroll Runs:     ${affectedPayrollRuns.length}`);

        // Test Clients Detail
        if (testClients.length > 0) {
            console.log('\n\nTEST CLIENTS');
            console.log('-'.repeat(40));
            for (const client of testClients) {
                console.log(`\n  ${client.name}`);
                console.log(`    Email: ${client.email}`);
                console.log(`    ID: ${client.id}`);
                console.log(`    Reason: ${client.matchReason}`);
            }
        }

        // Test Leads Detail
        if (testLeads.length > 0) {
            console.log('\n\nTEST LEADS');
            console.log('-'.repeat(40));
            for (const lead of testLeads) {
                console.log(`\n  ${lead.name}`);
                console.log(`    Email: ${lead.email}`);
                console.log(`    ID: ${lead.id}`);
                console.log(`    Reason: ${lead.matchReason}`);
            }
        }

        // Test Payments Detail
        if (linkedPayments.length > 0 || orphanedPayments.length > 0) {
            console.log('\n\nTEST PAYMENTS');
            console.log('-'.repeat(40));

            if (linkedPayments.length > 0) {
                console.log('\n  Linked to Test Clients:');
                for (const payment of linkedPayments) {
                    console.log(`    - ${payment.stripe_payment_id}: $${payment.amount.toFixed(2)}`);
                }
            }

            if (orphanedPayments.length > 0) {
                console.log('\n  With Test Stripe IDs (orphaned):');
                for (const payment of orphanedPayments) {
                    console.log(`    - ${payment.stripe_payment_id}: $${payment.amount.toFixed(2)}`);
                    if (payment.client_email) {
                        console.log(`      Client Email: ${payment.client_email}`);
                    }
                }
            }
        }

        // Affected Payroll Runs
        if (affectedPayrollRuns.length > 0) {
            console.log('\n\nAFFECTED PAYROLL RUNS');
            console.log('-'.repeat(40));
            console.log('  WARNING: These payroll runs contain test commissions');
            for (const run of affectedPayrollRuns) {
                console.log(`\n  Period: ${run.period_start} to ${run.period_end}`);
                console.log(`    Status: ${run.status}`);
                console.log(`    Total Commission: $${Number(run.total_commission || 0).toFixed(2)}`);
            }
        }

        // Deletion Order Guide
        console.log('\n\nRECOMMENDED DELETION ORDER');
        console.log('-'.repeat(40));
        console.log('  1. commission_adjustments (linked to affected payroll runs)');
        console.log('  2. commission_ledger (linked to test payments/clients)');
        console.log('  3. activity_logs (linked to test clients/leads)');
        console.log('  4. follow_up_tasks (linked to test leads)');
        console.log('  5. onboarding_tasks (linked to test clients)');
        console.log('  6. payments (test payments)');
        console.log('  7. leads (test leads)');
        console.log('  8. clients (test clients)');
        console.log('  9. payroll_runs (if now empty - verify first)');

        // Output IDs for deletion script
        console.log('\n\nIDs FOR DELETION');
        console.log('-'.repeat(40));
        console.log(`  Client IDs: ${clientIds.length > 0 ? clientIds.join(', ') : 'None'}`);
        console.log(`  Lead IDs: ${leadIds.length > 0 ? leadIds.join(', ') : 'None'}`);
        console.log(`  Payment IDs: ${allTestPaymentIds.length > 0 ? allTestPaymentIds.join(', ') : 'None'}`);

        console.log('\n' + '='.repeat(70));
        console.log('  Run scripts/delete-test-data.ts to remove this test data');
        console.log('='.repeat(70) + '\n');

    } catch (error) {
        console.error('Error during test data identification:', error);
        process.exit(1);
    }
}

main();
