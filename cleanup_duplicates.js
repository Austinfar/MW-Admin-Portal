// Clean up duplicate commission entries
// Run with: node cleanup_duplicates.js

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function cleanupDuplicates() {
  // Find payments with multiple coach entries (not voided)
  const { data: entries, error } = await supabase
    .from('commission_ledger')
    .select(`
      id,
      payment_id,
      user_id,
      client_id,
      commission_amount,
      net_amount,
      status,
      split_role,
      created_at,
      users:user_id (name),
      clients:client_id (name, assigned_coach_id)
    `)
    .eq('split_role', 'coach')
    .neq('status', 'void')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error:', error);
    return;
  }

  // Group by payment_id
  const byPayment = {};
  for (const entry of entries) {
    if (!byPayment[entry.payment_id]) {
      byPayment[entry.payment_id] = [];
    }
    byPayment[entry.payment_id].push(entry);
  }

  // Find duplicates
  const duplicates = Object.entries(byPayment).filter(([_, e]) => e.length > 1);

  console.log(`Found ${duplicates.length} payments with duplicate coach entries\n`);

  for (const [paymentId, dupes] of duplicates) {
    const clientName = dupes[0].clients?.name || 'Unknown';
    const currentCoachId = dupes[0].clients?.assigned_coach_id;

    console.log(`Payment ${paymentId} (${clientName}):`);

    // Find which entry belongs to the CURRENT coach (should keep)
    // and which is stale (should void)
    const currentCoachEntry = dupes.find(d => d.user_id === currentCoachId);
    const staleEntries = dupes.filter(d => d.user_id !== currentCoachId);

    if (currentCoachEntry) {
      console.log(`  ✓ Keep: ${currentCoachEntry.users?.name} - $${currentCoachEntry.commission_amount.toFixed(2)}`);
    }

    for (const stale of staleEntries) {
      console.log(`  ✗ Voiding: ${stale.users?.name} - $${stale.commission_amount.toFixed(2)} (Entry: ${stale.id})`);

      const { error: voidError } = await supabase
        .from('commission_ledger')
        .update({
          status: 'void',
          voided_at: new Date().toISOString()
        })
        .eq('id', stale.id);

      if (voidError) {
        console.log(`    ERROR voiding: ${voidError.message}`);
      } else {
        console.log(`    Successfully voided`);
      }
    }
    console.log('');
  }

  if (duplicates.length === 0) {
    console.log('No duplicates found - all clean!');
  }
}

cleanupDuplicates().catch(console.error);
