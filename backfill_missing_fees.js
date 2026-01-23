// Backfill missing Stripe fees for payments that have stripe_payment_id
// Run with: node backfill_missing_fees.js

const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function backfillMissingFees() {
  // Get payments missing stripe_fee but have stripe_payment_id
  const { data: payments, error } = await supabase
    .from('payments')
    .select('id, stripe_payment_id, amount, stripe_fee')
    .eq('status', 'succeeded')
    .not('stripe_payment_id', 'is', null)
    .or('stripe_fee.is.null,stripe_fee.eq.0');

  if (error) {
    console.error('Error fetching payments:', error);
    return;
  }

  console.log(`Found ${payments.length} payments missing fees\n`);

  let updated = 0;
  let failed = 0;

  for (const payment of payments) {
    try {
      // Fetch from Stripe with expanded balance_transaction
      let stripeFee = null;
      const stripeId = payment.stripe_payment_id;

      if (stripeId.startsWith('pi_')) {
        // PaymentIntent
        const pi = await stripe.paymentIntents.retrieve(stripeId, {
          expand: ['latest_charge.balance_transaction']
        });
        const charge = pi.latest_charge;
        if (charge && typeof charge !== 'string') {
          const bt = charge.balance_transaction;
          if (bt && typeof bt !== 'string') {
            stripeFee = bt.fee / 100;
          }
        }
      } else if (stripeId.startsWith('ch_')) {
        // Charge
        const charge = await stripe.charges.retrieve(stripeId, {
          expand: ['balance_transaction']
        });
        const bt = charge.balance_transaction;
        if (bt && typeof bt !== 'string') {
          stripeFee = bt.fee / 100;
        }
      }

      if (stripeFee !== null) {
        const netAmount = payment.amount - stripeFee;

        const { error: updateError } = await supabase
          .from('payments')
          .update({
            stripe_fee: stripeFee,
            net_amount: netAmount
          })
          .eq('id', payment.id);

        if (updateError) {
          console.log(`❌ ${stripeId}: Update failed - ${updateError.message}`);
          failed++;
        } else {
          console.log(`✓ ${stripeId}: $${payment.amount} → fee: $${stripeFee.toFixed(2)}, net: $${netAmount.toFixed(2)}`);
          updated++;
        }
      } else {
        console.log(`⚠ ${stripeId}: Could not get fee from Stripe (balance_transaction not available)`);
        failed++;
      }

      // Small delay to avoid rate limits
      await new Promise(r => setTimeout(r, 100));

    } catch (err) {
      console.log(`❌ ${payment.stripe_payment_id}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone: ${updated} updated, ${failed} failed`);
}

backfillMissingFees().catch(console.error);
