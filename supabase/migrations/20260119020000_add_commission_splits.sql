-- Add commission_splits to payment_schedules
ALTER TABLE public.payment_schedules
ADD COLUMN IF NOT EXISTS commission_splits JSONB DEFAULT '[]'::jsonb;

-- Add commission_splits to commission_ledger for future proofing
ALTER TABLE public.commission_ledger
ADD COLUMN IF NOT EXISTS commission_splits JSONB DEFAULT '[]'::jsonb;

-- Comment on column
COMMENT ON COLUMN public.payment_schedules.commission_splits IS 'Array of { userId, role, percentage } for commission splitting';
