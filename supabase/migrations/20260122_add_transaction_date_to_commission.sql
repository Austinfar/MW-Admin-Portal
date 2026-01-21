-- Add transaction_date to commission_ledger to store the actual payment date
-- This allows showing when the transaction actually occurred, not when the commission was calculated

ALTER TABLE public.commission_ledger
ADD COLUMN IF NOT EXISTS transaction_date TIMESTAMP WITH TIME ZONE;

-- Backfill transaction_date from the associated payment's date
UPDATE public.commission_ledger cl
SET transaction_date = COALESCE(p.payment_date, p.created_at)
FROM public.payments p
WHERE cl.payment_id = p.id
AND cl.transaction_date IS NULL;

-- Add an index for efficient queries by transaction date
CREATE INDEX IF NOT EXISTS idx_commission_ledger_transaction_date
ON public.commission_ledger(transaction_date);

-- Add comment for documentation
COMMENT ON COLUMN public.commission_ledger.transaction_date IS 'The actual date of the payment transaction (from payments table)';
