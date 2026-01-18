import { config } from 'dotenv';
config({ path: '.env.local' }); // Load env vars

import { createClient } from '@supabase/supabase-js';

// Re-implement createAdminClient locally to avoid import issues if aliases fail
const createAdminClient = () => {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing');
    }
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        }
    );
};

export async function runDebug() {
    console.log("Starting debug script...");
    const supabase = createAdminClient();

    console.log("Fetching pending charges with !inner...");
    const { data: charges, error } = await supabase
        .from('scheduled_charges')
        .select(`
            id,
            amount,
            schedule_id,
            payment_schedules!inner (
                stripe_customer_id,
                stripe_payment_method_id
            )
        `)
        .eq('status', 'pending')
        .lte('due_date', new Date().toISOString())
        .not('payment_schedules.stripe_customer_id', 'is', null)
        .not('payment_schedules.stripe_payment_method_id', 'is', null);

    if (error) {
        console.error('Error fetching due charges:', error);
        return;
    }

    if (!charges || charges.length === 0) {
        console.log('No charges due found (after inner join).');
        return;
    }

    console.log(`Found ${charges.length} charges.`);

    for (const charge of charges) {
        console.log(`\n--- Inspecting Charge ${charge.id} ---`);
        console.log(`Schedule ID: ${charge.schedule_id}`);
        console.log('payment_schedules raw:', charge.payment_schedules);

        const scheduleData = charge.payment_schedules;
        const isArray = Array.isArray(scheduleData);
        console.log('Is payment_schedules an array?', isArray);

        const schedule = isArray ? scheduleData[0] : scheduleData;
        console.log('Resolved schedule object:', schedule);

        if (!schedule) {
            console.log('!! Schedule is null/undefined');
        } else {
            console.log('Stripe Customer ID:', schedule.stripe_customer_id);
            console.log('Stripe PM ID:', schedule.stripe_payment_method_id);
        }
    }
}

runDebug();
