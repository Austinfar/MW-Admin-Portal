// Check for duplicate commission entries
// Run with: node check_duplicates.js

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkDuplicates() {
  // Find payments with multiple commission entries (potential duplicates)
  const { data: entries, error } = await supabase
    .from('commission_ledger')
    .select(`
      id,
      payment_id,
      user_id,
      client_id,
      commission_amount,
      status,
      split_role,
      created_at,
      users:user_id (name),
      clients:client_id (name)
    `)
    .eq('split_role', 'coach')  // Focus on coach entries since that's where duplicates are
    .neq('status', 'void')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error:', error);
    return;
  }

  // Group by payment_id to find duplicates
  const byPayment = {};
  for (const entry of entries) {
    if (!byPayment[entry.payment_id]) {
      byPayment[entry.payment_id] = [];
    }
    byPayment[entry.payment_id].push(entry);
  }

  // Find payments with multiple coach entries
  const duplicates = Object.entries(byPayment).filter(([_, entries]) => entries.length > 1);

  console.log(`\n=== Duplicate Coach Commissions ===\n`);
  console.log(`Total coach entries: ${entries.length}`);
  console.log(`Payments with multiple coach entries: ${duplicates.length}\n`);

  if (duplicates.length > 0) {
    console.log('--- Duplicate Details ---\n');

    for (const [paymentId, dupes] of duplicates) {
      const clientName = dupes[0].clients?.name || 'Unknown';
      console.log(`Payment ${paymentId} (${clientName}):`);

      for (const d of dupes) {
        const coachName = d.users?.name || 'Unknown';
        const date = new Date(d.created_at).toLocaleString();
        console.log(`  - ${coachName}: $${d.commission_amount.toFixed(2)} (${d.status}) - created ${date}`);
        console.log(`    Entry ID: ${d.id}`);
      }
      console.log('');
    }

    // Check Yusef Caro specifically
    console.log('\n--- Yusef Caro Client Check ---\n');
    const { data: yusef } = await supabase
      .from('clients')
      .select('id, name, assigned_coach_id, coach_history, users:assigned_coach_id(name)')
      .ilike('name', '%yusef%')
      .single();

    if (yusef) {
      console.log(`Client: ${yusef.name}`);
      console.log(`Current Coach: ${yusef.users?.name || 'None'} (${yusef.assigned_coach_id})`);
      console.log(`Coach History:`, JSON.stringify(yusef.coach_history, null, 2));
    }
  }
}

checkDuplicates().catch(console.error);
