import { createAdminClient } from '../src/lib/supabase/admin';

async function testQuery() {
    console.log('Testing getPaymentSchedule query...');
    const supabase = createAdminClient();

    // Try the exact query that is likely failing
    const { data, error } = await supabase
        .from('payment_schedules')
        .select('*, scheduled_charges(*), coach:users!assigned_coach_id(name)')
        .limit(1);

    if (error) {
        console.error('Query Failed:', error);
    } else {
        console.log('Query Successful:', data);
    }
}

testQuery();
