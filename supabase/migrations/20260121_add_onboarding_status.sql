-- Migration: Add 'onboarding' to clients status constraint
-- This fixes an issue where clients created via Stripe webhooks fail to insert
-- because the webhook sets status='onboarding' but the constraint only allows
-- 'active', 'inactive', 'lost'

-- Drop the existing constraint
ALTER TABLE public.clients
DROP CONSTRAINT IF EXISTS clients_status_check;

-- Add the new constraint with 'onboarding' included
ALTER TABLE public.clients
ADD CONSTRAINT clients_status_check
CHECK (status IN ('active', 'inactive', 'lost', 'onboarding'));

-- Update the default to remain 'active' for manual client creation
-- (onboarding status is set explicitly by Stripe webhook)
