-- Migration: Normalize all payment and subscription amounts to dollars
-- Problem: Some amounts may be stored in cents (Stripe's native format) while
-- sync code stores in dollars. This creates inconsistent display.
--
-- Solution: Detect cent values (amounts > 1000 that look like cents) and convert to dollars.
-- Assumption: No single payment/subscription should be > $10,000, so if amount > 10000, it's likely cents.

-- ============================================
-- 1. NORMALIZE PAYMENTS TABLE
-- ============================================
-- Payments with amount > 10000 are likely in cents (e.g., 35000 cents = $350)
-- We divide these by 100 to convert to dollars

UPDATE public.payments
SET amount = amount / 100
WHERE amount > 10000
  AND status IN ('succeeded', 'pending', 'failed', 'refunded', 'partially_refunded', 'disputed');

-- Also normalize refund_amount if it exists and is in cents
UPDATE public.payments
SET refund_amount = refund_amount / 100
WHERE refund_amount > 10000;

-- ============================================
-- 2. NORMALIZE SUBSCRIPTIONS TABLE
-- ============================================
-- Same logic: amounts > 10000 are likely in cents

UPDATE public.subscriptions
SET amount = amount / 100
WHERE amount > 10000;

-- ============================================
-- 3. ADD COMMENTS FOR DOCUMENTATION
-- ============================================
COMMENT ON COLUMN public.payments.amount IS 'Payment amount in dollars (USD). Converted from Stripe cents during sync.';
COMMENT ON COLUMN public.subscriptions.amount IS 'Subscription amount in dollars (USD). Converted from Stripe cents during sync.';

-- ============================================
-- 4. LOG THE MIGRATION
-- ============================================
INSERT INTO public.sync_logs (source, event_type, status, details)
VALUES (
    'stripe',
    'amount_normalization_migration',
    'success',
    jsonb_build_object(
        'description', 'Normalized payment and subscription amounts from cents to dollars where amount > 10000',
        'executed_at', now()
    )
);
