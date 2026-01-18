-- Remove UNIQUE constraint from payment_id to allow multiple commission entries (splits) per payment
ALTER TABLE public.commission_ledger
DROP CONSTRAINT IF EXISTS commission_ledger_payment_id_key;

-- Make sure we still have an index for performance
CREATE INDEX IF NOT EXISTS idx_commission_ledger_payment_id ON public.commission_ledger(payment_id);
