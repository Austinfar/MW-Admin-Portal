// Quick script to check payments missing stripe fees
// Run with: node check_missing_fees.js

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkMissingFees() {
  // Get payments with client_id that are missing stripe_fee
  const { data: missingFees, error: missingError } = await supabase
    .from('payments')
    .select('id, stripe_payment_id, amount, stripe_fee, payment_date, client_email')
    .eq('status', 'succeeded')
    .not('client_id', 'is', null)
    .or('stripe_fee.is.null,stripe_fee.eq.0')
    .order('payment_date', { ascending: false })
    .limit(100);

  if (missingError) {
    console.error('Error:', missingError);
    return;
  }

  // Get total counts
  const { count: totalPayments } = await supabase
    .from('payments')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'succeeded')
    .not('client_id', 'is', null);

  const { count: missingCount } = await supabase
    .from('payments')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'succeeded')
    .not('client_id', 'is', null)
    .or('stripe_fee.is.null,stripe_fee.eq.0');

  const { count: hasFeesCount } = await supabase
    .from('payments')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'succeeded')
    .not('client_id', 'is', null)
    .not('stripe_fee', 'is', null)
    .gt('stripe_fee', 0);

  console.log('\n=== Stripe Fee Analysis ===\n');
  console.log(`Total succeeded payments (with client): ${totalPayments}`);
  console.log(`Payments WITH fees:    ${hasFeesCount}`);
  console.log(`Payments MISSING fees: ${missingCount}`);
  console.log(`\nPercentage missing: ${((missingCount / totalPayments) * 100).toFixed(1)}%`);

  if (missingFees && missingFees.length > 0) {
    console.log('\n--- Sample of payments missing fees (most recent first) ---\n');

    const totalMissingAmount = missingFees.reduce((sum, p) => sum + Number(p.amount), 0);

    missingFees.slice(0, 20).forEach(p => {
      const date = new Date(p.payment_date).toLocaleDateString();
      const hasStripeId = p.stripe_payment_id ? '✓' : '✗';
      console.log(`  ${date} | $${p.amount.toFixed(2).padStart(8)} | Stripe ID: ${hasStripeId} | ${p.client_email || 'no email'}`);
    });

    if (missingFees.length > 20) {
      console.log(`  ... and ${missingFees.length - 20} more`);
    }

    // Check how many have stripe_payment_id (can be backfilled)
    const canBackfill = missingFees.filter(p => p.stripe_payment_id).length;
    console.log(`\n${canBackfill} of ${missingFees.length} shown have stripe_payment_id (can be backfilled from Stripe)`);
  }
}

checkMissingFees().catch(console.error);
