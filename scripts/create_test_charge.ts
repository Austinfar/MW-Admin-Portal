import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const createAdminClient = () => {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing');
    }
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
};

export async function createTestCharge() {
    const supabase = createAdminClient();

    console.log("Finding a valid payment schedule...");
    const { data: schedules, error: schedError } = await supabase
        .from('payment_schedules')
        .select('id, stripe_customer_id, stripe_payment_method_id')
        .eq('status', 'active')
        .not('stripe_customer_id', 'is', null)
        .not('stripe_payment_method_id', 'is', null)
        .limit(1);

    if (schedError) {
        console.error("Error fetching schedules:", schedError);
        return;
    }

    if (!schedules || schedules.length === 0) {
        console.error("No valid active payment schedules found. Cannot create test charge.");
        return;
    }

    const schedule = schedules[0];
    console.log(`Found schedule ${schedule.id}. Creating test charge...`);

    const { data: charge, error: chargeError } = await supabase
        .from('scheduled_charges')
        .insert({
            schedule_id: schedule.id,
            amount: 100, // $1.00
            due_date: new Date(Date.now() - 86400000).toISOString(), // Yesterday
            status: 'pending'
        })
        .select()
        .single();

    if (chargeError) {
        console.error("Error creating charge:", chargeError);
    } else {
        console.log(`Successfully created test charge: ${charge.id}`);
        console.log(`Amount: $1.00, Due: ${charge.due_date}`);
        console.log("Run the cron job now to test processing.");
    }
}

createTestCharge();
