-- Add stripe_product_name column to payment_schedules
-- This stores the actual Stripe product name from the checkout session
ALTER TABLE public.payment_schedules
ADD COLUMN IF NOT EXISTS stripe_product_name TEXT;

-- Add comment for clarity
COMMENT ON COLUMN public.payment_schedules.stripe_product_name IS 'The product name from Stripe line items at checkout time';
