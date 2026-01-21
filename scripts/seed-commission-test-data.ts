/**
 * Seed script for Commission System Test Data
 * Run with: npx tsx scripts/seed-commission-test-data.ts
 *
 * Commission Calculation Logic:
 * 1. Stripe fees - deducted first from gross
 * 2. Closer - 10% of GROSS (if assigned)
 * 3. Setter - 10% of GROSS (if assigned)
 * 4. Referrer - $100 flat fee on first payment only
 * 5. Coach - 50-70% of REMAINDER (after fees + other commissions)
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing environment variables. Make sure .env.local exists.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function clearExistingTestData() {
    console.log('🧹 Clearing existing test data...\n');

    // Delete in order of dependencies
    // 1. Delete commission adjustments
    const { error: adjError } = await supabase
        .from('commission_adjustments')
        .delete()
        .not('id', 'is', null); // Delete all

    if (adjError) console.log('  Adjustments:', adjError.message);
    else console.log('  ✓ Cleared commission_adjustments');

    // 2. Delete commission ledger entries
    const { error: ledgerError } = await supabase
        .from('commission_ledger')
        .delete()
        .not('id', 'is', null);

    if (ledgerError) console.log('  Ledger:', ledgerError.message);
    else console.log('  ✓ Cleared commission_ledger');

    // 3. Delete payroll runs
    const { error: payrollError } = await supabase
        .from('payroll_runs')
        .delete()
        .not('id', 'is', null);

    if (payrollError) console.log('  Payroll runs:', payrollError.message);
    else console.log('  ✓ Cleared payroll_runs');

    // 4. Delete test payments (only those with test stripe IDs)
    const { error: paymentsError } = await supabase
        .from('payments')
        .delete()
        .like('stripe_payment_id', 'pi_test_%');

    if (paymentsError) console.log('  Payments:', paymentsError.message);
    else console.log('  ✓ Cleared test payments');

    // 5. Delete test clients (only those with test emails)
    const { error: clientsError } = await supabase
        .from('clients')
        .delete()
        .like('email', '%.test.%@example.com');

    if (clientsError) console.log('  Clients:', clientsError.message);
    else console.log('  ✓ Cleared test clients');

    console.log('');
}

async function seedTestData() {
    console.log('🌱 Seeding Commission System Test Data...\n');
    console.log('Commission Logic:');
    console.log('  • Closer/Setter: 10% of GROSS');
    console.log('  • Referrer: $100 flat (first payment only)');
    console.log('  • Coach: 50-70% of REMAINDER (after fees + splits)\n');

    // Clear existing data first
    await clearExistingTestData();

    // 1. First, get existing users to use as coaches/closers/setters
    const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, name, email, role, job_title')
        .eq('is_active', true)
        .limit(5);

    if (usersError || !users || users.length === 0) {
        console.error('❌ No users found. Please ensure you have users in the database.');
        return;
    }

    console.log(`Found ${users.length} users:`);
    users.forEach(u => console.log(`  - ${u.name} (${u.job_title || u.role})`));

    // Assign roles from existing users - ensure each role has a unique user
    const coach = users.find(u => u.job_title === 'coach' || u.job_title === 'head_coach') || users[0];
    const usedIds = new Set([coach.id]);

    // Find closer - must be different from coach
    let closer = users.find(u => u.job_title === 'closer' && !usedIds.has(u.id));
    if (!closer) closer = users.find(u => !usedIds.has(u.id)) || users[0];
    usedIds.add(closer.id);

    // Find setter - must be different from coach and closer
    let setter = users.find(u => !usedIds.has(u.id));
    if (!setter) setter = users[0]; // Fallback, but may cause issues
    usedIds.add(setter.id);

    // Find admin - can overlap with others but prefer unique
    const admin = users.find(u => (u.role === 'super_admin' || u.role === 'admin')) || users[0];

    console.log(`\nUsing:`);
    console.log(`  Coach: ${coach.name}`);
    console.log(`  Closer: ${closer.name}`);
    console.log(`  Setter: ${setter.name}`);
    console.log(`  Admin: ${admin.name}`);

    // 2. Get or create a client type
    let { data: clientType } = await supabase
        .from('client_types')
        .select('id, name')
        .eq('is_active', true)
        .limit(1)
        .single();

    if (!clientType) {
        const { data: newType } = await supabase
            .from('client_types')
            .insert({ name: '12-Week Transformation', description: 'Standard coaching program', is_active: true })
            .select()
            .single();
        clientType = newType;
    }

    console.log(`\nClient Type: ${clientType?.name}`);

    // 3. Create test clients with different scenarios
    const timestamp = Date.now();
    const testClients = [
        {
            name: 'John Smith (Full Team - $3000)',
            email: `john.smith.test.${timestamp}@example.com`,
            phone: `+1555${timestamp.toString().slice(-6)}1`,
            status: 'active',
            lead_source: 'company_driven',
            assigned_coach_id: coach.id,
            sold_by_user_id: closer.id,
            appointment_setter_id: setter.id,
            client_type_id: clientType?.id,
            ghl_contact_id: `test_${Date.now()}_1`,
            start_date: new Date().toISOString().split('T')[0],
            stripe_customer_id: `cus_test_${Date.now()}_1`,
            coach_history: JSON.stringify([{
                coach_id: coach.id,
                start_date: new Date().toISOString().split('T')[0],
                end_date: null
            }])
        },
        {
            name: 'Sarah Johnson (Coach Self-Gen)',
            email: `sarah.johnson.test.${timestamp}@example.com`,
            phone: `+1555${timestamp.toString().slice(-6)}2`,
            status: 'active',
            lead_source: 'coach_driven',
            assigned_coach_id: coach.id,
            sold_by_user_id: null, // No closer for self-gen
            appointment_setter_id: null, // No setter for self-gen
            client_type_id: clientType?.id,
            ghl_contact_id: `test_${Date.now()}_2`,
            start_date: new Date().toISOString().split('T')[0],
            stripe_customer_id: `cus_test_${Date.now()}_2`,
            coach_history: JSON.stringify([{
                coach_id: coach.id,
                start_date: new Date().toISOString().split('T')[0],
                end_date: null
            }])
        },
        {
            name: 'Mike Davis (Closer Only)',
            email: `mike.davis.test.${timestamp}@example.com`,
            phone: `+1555${timestamp.toString().slice(-6)}3`,
            status: 'active',
            lead_source: 'company_driven',
            assigned_coach_id: coach.id,
            sold_by_user_id: closer.id,
            appointment_setter_id: null, // No setter
            client_type_id: clientType?.id,
            ghl_contact_id: `test_${Date.now()}_3`,
            start_date: new Date().toISOString().split('T')[0],
            stripe_customer_id: `cus_test_${Date.now()}_3`,
            coach_history: JSON.stringify([{
                coach_id: coach.id,
                start_date: new Date().toISOString().split('T')[0],
                end_date: null
            }])
        }
    ];

    console.log('\n📝 Creating test clients...');
    const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .insert(testClients)
        .select();

    if (clientsError) {
        console.error('❌ Error creating clients:', clientsError.message);
        return;
    }

    console.log(`✅ Created ${clients.length} test clients`);

    // 4. Create test payments for each client
    const payments = [];
    const now = new Date();

    // Client 1: John Smith - Full Team Sale ($3000)
    // This demonstrates: Closer (10% gross) + Setter (10% gross) + Coach (50% remainder)
    payments.push({
        stripe_payment_id: `pi_test_${timestamp}_${clients[0].id}_1`,
        amount: 3000.00,
        stripe_fee: 117.30, // ~3.9% for Stripe
        net_amount: 3000.00 - 117.30,
        currency: 'usd',
        status: 'succeeded',
        client_id: clients[0].id,
        payment_date: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        product_name: 'Payment 1 of 1 - Premium Coaching Package'
    });

    // Client 2: Sarah Johnson - Self-Gen ($2000)
    // This demonstrates: Coach only (70% of net, no other splits)
    payments.push({
        stripe_payment_id: `pi_test_${timestamp}_${clients[1].id}_1`,
        amount: 2000.00,
        stripe_fee: 78.30,
        net_amount: 2000.00 - 78.30,
        currency: 'usd',
        status: 'succeeded',
        client_id: clients[1].id,
        payment_date: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString(),
        product_name: 'Payment 1 of 2 - 12-Week Program'
    });

    payments.push({
        stripe_payment_id: `pi_test_${timestamp}_${clients[1].id}_2`,
        amount: 1000.00,
        stripe_fee: 39.30,
        net_amount: 1000.00 - 39.30,
        currency: 'usd',
        status: 'succeeded',
        client_id: clients[1].id,
        payment_date: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        product_name: 'Payment 2 of 2 - 12-Week Program'
    });

    // Client 3: Mike Davis - Closer Only ($1500)
    // This demonstrates: Closer (10% gross) + Coach (50% remainder after fees and closer)
    payments.push({
        stripe_payment_id: `pi_test_${timestamp}_${clients[2].id}_1`,
        amount: 1500.00,
        stripe_fee: 58.80,
        net_amount: 1500.00 - 58.80,
        currency: 'usd',
        status: 'succeeded',
        client_id: clients[2].id,
        payment_date: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        product_name: 'Payment 1 of 1 - Coaching Package'
    });

    console.log('\n💳 Creating test payments...');
    const { data: createdPayments, error: paymentsError } = await supabase
        .from('payments')
        .insert(payments)
        .select();

    if (paymentsError) {
        console.error('❌ Error creating payments:', paymentsError.message);
        return;
    }

    console.log(`✅ Created ${createdPayments.length} test payments`);

    // 5. Create commission ledger entries with NEW calculation logic
    const ledgerEntries = [];
    const periodStart = getPayoutPeriodStart(now);

    console.log('\n📊 Calculating commissions with new logic...\n');

    for (const payment of createdPayments) {
        const client = clients.find(c => c.id === payment.client_id)!;
        const grossAmount = payment.amount;
        const stripeFee = payment.stripe_fee;
        const afterFees = grossAmount - stripeFee;
        const isCompanyDriven = client.lead_source === 'company_driven';
        const coachRate = isCompanyDriven ? 0.50 : 0.70;

        let totalOtherCommissions = 0;
        const paymentEntries = [];

        console.log(`  ${client.name} - $${grossAmount.toFixed(2)} payment:`);
        console.log(`    Gross: $${grossAmount.toFixed(2)}`);
        console.log(`    Stripe Fee: $${stripeFee.toFixed(2)}`);
        console.log(`    After Fees: $${afterFees.toFixed(2)}`);

        // Closer commission (10% of GROSS) - if has closer
        if (client.sold_by_user_id) {
            const closerCommission = grossAmount * 0.10;
            totalOtherCommissions += closerCommission;
            console.log(`    Closer (10% gross): $${closerCommission.toFixed(2)}`);

            paymentEntries.push({
                user_id: client.sold_by_user_id,
                client_id: client.id,
                payment_id: payment.id,
                gross_amount: grossAmount,
                net_amount: afterFees,
                commission_amount: closerCommission,
                calculation_basis: {
                    type: 'closer',
                    rate: 0.10,
                    basis: 'gross'
                },
                status: 'pending',
                payout_period_start: periodStart,
                entry_type: 'split',
                split_role: 'closer',
                split_percentage: 10
            });
        }

        // Setter commission (10% of GROSS) - if has setter
        if (client.appointment_setter_id) {
            const setterCommission = grossAmount * 0.10;
            totalOtherCommissions += setterCommission;
            console.log(`    Setter (10% gross): $${setterCommission.toFixed(2)}`);

            paymentEntries.push({
                user_id: client.appointment_setter_id,
                client_id: client.id,
                payment_id: payment.id,
                gross_amount: grossAmount,
                net_amount: afterFees,
                commission_amount: setterCommission,
                calculation_basis: {
                    type: 'setter',
                    rate: 0.10,
                    basis: 'gross'
                },
                status: 'pending',
                payout_period_start: periodStart,
                entry_type: 'split',
                split_role: 'setter',
                split_percentage: 10
            });
        }

        // Coach commission (% of REMAINDER after fees and other commissions)
        const remainderForCoach = afterFees - totalOtherCommissions;
        const coachCommission = remainderForCoach * coachRate;

        console.log(`    Remainder for Coach: $${remainderForCoach.toFixed(2)}`);
        console.log(`    Coach (${(coachRate * 100).toFixed(0)}% remainder): $${coachCommission.toFixed(2)}`);
        console.log('');

        paymentEntries.push({
            user_id: coach.id,
            client_id: client.id,
            payment_id: payment.id,
            gross_amount: grossAmount,
            net_amount: remainderForCoach, // This is the basis for coach calculation
            commission_amount: coachCommission,
            calculation_basis: {
                type: 'coach',
                rate: coachRate,
                basis: 'remainder',
                lead_source: client.lead_source,
                stripe_fee: stripeFee,
                other_commissions: totalOtherCommissions,
                remainder_amount: remainderForCoach
            },
            status: 'pending',
            payout_period_start: periodStart,
            entry_type: 'commission',
            split_role: 'coach',
            split_percentage: coachRate * 100
        });

        ledgerEntries.push(...paymentEntries);
    }

    console.log('📊 Creating commission ledger entries...');
    const { data: ledger, error: ledgerError } = await supabase
        .from('commission_ledger')
        .insert(ledgerEntries)
        .select();

    if (ledgerError) {
        console.error('❌ Error creating ledger entries:', ledgerError.message);
        return;
    }

    console.log(`✅ Created ${ledger.length} commission ledger entries`);

    // 6. Create a test adjustment (bonus)
    console.log('\n🎁 Creating test adjustment...');
    const { error: adjError } = await supabase
        .from('commission_adjustments')
        .insert({
            user_id: coach.id,
            amount: 250.00,
            adjustment_type: 'bonus',
            reason: 'Performance bonus for January',
            notes: 'Exceeded monthly targets by 20%',
            created_by: admin.id,
            is_visible_to_user: true
        });

    if (adjError) {
        console.error('❌ Error creating adjustment:', adjError.message);
    } else {
        console.log('✅ Created test bonus adjustment');
    }

    // Summary
    const totalCommission = ledger.reduce((sum, e) => sum + Number(e.commission_amount), 0);

    console.log('\n' + '='.repeat(60));
    console.log('📊 SEED DATA SUMMARY');
    console.log('='.repeat(60));
    console.log(`Clients created: ${clients.length}`);
    console.log(`Payments created: ${createdPayments.length}`);
    console.log(`Commission entries: ${ledger.length}`);
    console.log(`Total commission: $${totalCommission.toFixed(2)}`);
    console.log(`Adjustments: $250.00 (bonus)`);
    console.log('');
    console.log('Commission Breakdown:');

    // Group by role
    const byRole: Record<string, number> = {};
    for (const entry of ledger) {
        const role = entry.split_role || 'coach';
        byRole[role] = (byRole[role] || 0) + Number(entry.commission_amount);
    }
    for (const [role, amount] of Object.entries(byRole)) {
        console.log(`  ${role.charAt(0).toUpperCase() + role.slice(1)}: $${amount.toFixed(2)}`);
    }

    console.log('\n✨ Done! Visit /commissions to see the data.');
}

// Helper function to calculate payout period start (bi-weekly, Monday-based)
function getPayoutPeriodStart(date: Date): string {
    const anchor = new Date('2024-12-16'); // Monday anchor
    const diffTime = date.getTime() - anchor.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const periodNumber = Math.floor(diffDays / 14);
    const periodStart = new Date(anchor);
    periodStart.setDate(anchor.getDate() + (periodNumber * 14));
    return periodStart.toISOString().split('T')[0];
}

// Run the seed
seedTestData().catch(console.error);
