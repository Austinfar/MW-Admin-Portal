import { createAdminClient } from '@/lib/supabase/admin';
import { calculateCommission } from '@/lib/logic/commissions';
// import { v4 as uuidv4 } from 'uuid'; // uuid not available
import { randomUUID } from 'crypto';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function seed() {
    console.log('Starting seed...');
    const supabase = createAdminClient();


    // 1. Create a User (Coach)
    const coachEmail = `coach_${Date.now()}@example.com`;
    const coachId = randomUUID();

    // Auth user creation is tricky in raw scripts without auth admin API fully wrapped or having service role key.
    // Assuming createAdminClient uses service role key.

    // We'll insert directly into public.users if possible, but usually need auth.users ref.
    // For simplicity, let's try to find an EXISTING coach or just insert if no FK constraint blocks us (unlikely for auth.users usually).
    // Actually, `users.id` references `auth.users(id)`. 
    // Let's try to find an existing coach first.

    let { data: coach } = await supabase.from('users').select('id').eq('role', 'coach').limit(1).single();

    if (!coach) {
        console.log('No existing coach found. Skipping seed or need to manually create one.');
        // Try to create one if we can access auth.admin
        const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
            email: coachEmail,
            email_confirm: true,
            password: 'password123'
        });

        if (authError || !authUser.user) {
            console.error('Failed to create auth user', authError);
            return;
        }

        coach = { id: authUser.user.id };

        await supabase.from('users').insert({
            id: coach.id,
            email: coachEmail,
            name: 'Test Coach',
            role: 'coach',
            commission_config: { company_lead_rate: 0.5 }
        });
        console.log('Created test coach:', coach.id);
    } else {
        console.log('Using existing coach:', coach.id);
    }

    // 2. Create a Client
    const clientId = randomUUID();
    const { error: clientError } = await supabase.from('clients').insert({
        id: clientId,
        name: 'Test ClientCommission',
        email: `client_${Date.now()}@example.com`,
        ghl_contact_id: `ghl_${Date.now()}`,
        assigned_coach_id: coach.id,
        lead_source: 'company_driven',
        start_date: new Date().toISOString(),
        status: 'active'
    });

    if (clientError) {
        console.error('Failed to create client', clientError);
        return;
    }
    console.log('Created test client:', clientId);

    // 3. Create a Payment
    const paymentId = randomUUID();
    const amount = 1000.00; // $1000
    const stripeFee = 30.00; // $30

    const { error: paymentError } = await supabase.from('payments').insert({
        id: paymentId,
        stripe_payment_id: `pi_test_${Date.now()}`,
        amount: amount,
        stripe_fee: stripeFee,
        net_amount: amount - stripeFee,
        currency: 'usd',
        status: 'succeeded',
        payment_date: new Date().toISOString(),
        client_id: clientId,
        product_name: 'Test Product'
    });

    if (paymentError) {
        console.error('Failed to create payment', paymentError);
        return;
    }
    console.log('Created test payment:', paymentId);

    // 4. Run Calculation
    console.log('Running calculateCommission...');
    await calculateCommission(paymentId);

    // 5. Verify Ledger
    const { data: ledger, error: ledgerError } = await supabase
        .from('commission_ledger')
        .select('*')
        .eq('payment_id', paymentId)
        .single();

    if (ledgerError || !ledger) {
        console.error('Verification FAILED: No ledger entry found.', ledgerError);
    } else {
        console.log('Verification SUCCESS: Ledger entry found!');
        console.log(ledger);
        console.log(`Commission Amount: ${ledger.commission_amount}`);
        console.log(`Expected (roughly 50% of 970): 485`);
    }
}

seed().catch(console.error);
