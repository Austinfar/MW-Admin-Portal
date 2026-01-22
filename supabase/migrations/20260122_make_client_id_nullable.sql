-- Make client_id nullable in commission_ledger to support manual commissions (bonuses, adjustments)
ALTER TABLE public.commission_ledger ALTER COLUMN client_id DROP NOT NULL;
