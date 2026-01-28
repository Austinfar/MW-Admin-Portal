-- Add stripe_payment_intent_id to payment_schedules for linking to the initial payment
-- This allows us to link directly to the Stripe payment (which persists) rather than
-- the checkout session (which expires after 24 hours)

ALTER TABLE payment_schedules ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;

COMMENT ON COLUMN payment_schedules.stripe_payment_intent_id IS 'Payment intent ID from the initial checkout session payment';
