-- ============================================================================
-- FIX COMMISSION REFUNDS MIGRATION
-- 1. Make payment_id nullable for manual commission entries
-- 2. Add index for faster refund lookups
-- ============================================================================

-- Make payment_id nullable in commission_ledger to support manual entries
ALTER TABLE public.commission_ledger ALTER COLUMN payment_id DROP NOT NULL;

-- Add index for chargeback lookups by related_payment_id
CREATE INDEX IF NOT EXISTS idx_commission_adjustments_related_payment
ON commission_adjustments(related_payment_id)
WHERE related_payment_id IS NOT NULL;

-- Add index for chargeback lookups by related_ledger_id
CREATE INDEX IF NOT EXISTS idx_commission_adjustments_related_ledger
ON commission_adjustments(related_ledger_id)
WHERE related_ledger_id IS NOT NULL;

-- Update unique constraint to allow null payment_id
-- First drop the old constraint
ALTER TABLE public.commission_ledger
DROP CONSTRAINT IF EXISTS unique_user_payment;

-- Create a partial unique index instead (ignores nulls)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_user_payment
ON commission_ledger(user_id, payment_id)
WHERE payment_id IS NOT NULL;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON COLUMN commission_ledger.payment_id IS
  'Reference to payments table. NULL for manual entries (bonuses, adjustments imported without payment).';
