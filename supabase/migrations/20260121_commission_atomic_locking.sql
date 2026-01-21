-- ============================================================================
-- COMMISSION ATOMIC LOCKING SYSTEM
-- Prevents race conditions in commission calculation
-- ============================================================================

-- Add new columns to payments table for atomic locking
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS commission_locked_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS review_flagged_at TIMESTAMPTZ;

-- Add idempotency_key to commission_adjustments for chargeback deduplication
ALTER TABLE commission_adjustments
ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;

-- Create index for idempotency lookups
CREATE INDEX IF NOT EXISTS idx_commission_adjustments_idempotency
ON commission_adjustments(idempotency_key)
WHERE idempotency_key IS NOT NULL;

-- ============================================================================
-- FUNCTION: lock_payment_for_commission
-- Atomically locks a payment for commission calculation
-- Returns TRUE if lock acquired, FALSE if already calculated/locked
-- ============================================================================
CREATE OR REPLACE FUNCTION lock_payment_for_commission(p_payment_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_locked BOOLEAN;
BEGIN
    -- Atomic check and update using UPDATE ... RETURNING
    -- This prevents race conditions because UPDATE locks the row
    UPDATE payments
    SET commission_calculated = true,
        commission_locked_at = NOW()
    WHERE id = p_payment_id
      AND (commission_calculated = false OR commission_calculated IS NULL)
    RETURNING true INTO v_locked;

    -- Return false if no row was updated (already calculated)
    RETURN COALESCE(v_locked, false);
END;
$$;

-- ============================================================================
-- FUNCTION: unlock_payment_for_commission
-- Unlocks a payment (for recalculation scenarios)
-- ============================================================================
CREATE OR REPLACE FUNCTION unlock_payment_for_commission(p_payment_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_unlocked BOOLEAN;
BEGIN
    UPDATE payments
    SET commission_calculated = false,
        commission_locked_at = NULL
    WHERE id = p_payment_id
      AND commission_calculated = true
    RETURNING true INTO v_unlocked;

    RETURN COALESCE(v_unlocked, false);
END;
$$;

-- ============================================================================
-- FUNCTION: check_is_first_payment
-- Atomically checks if this is the first commission for a client
-- Uses advisory lock to prevent race conditions
-- ============================================================================
CREATE OR REPLACE FUNCTION check_is_first_payment(p_client_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_is_first BOOLEAN;
    v_lock_key BIGINT;
BEGIN
    -- Generate a lock key from the client ID
    v_lock_key := hashtext(p_client_id::text);

    -- Acquire advisory lock (released at end of transaction)
    PERFORM pg_advisory_xact_lock(v_lock_key);

    -- Check if any commission entries exist for this client
    SELECT NOT EXISTS (
        SELECT 1 FROM commission_ledger
        WHERE client_id = p_client_id
        AND entry_type IN ('commission', 'split')
        AND status != 'void'
    ) INTO v_is_first;

    RETURN v_is_first;
END;
$$;

-- ============================================================================
-- FUNCTION: void_commission_entries
-- Voids all commission entries for a payment (for recalculation)
-- Returns count of voided entries
-- ============================================================================
CREATE OR REPLACE FUNCTION void_commission_entries(p_payment_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE commission_ledger
    SET status = 'void',
        voided_at = NOW()
    WHERE payment_id = p_payment_id
      AND status != 'void'
    RETURNING 1 INTO v_count;

    -- Get actual count
    GET DIAGNOSTICS v_count = ROW_COUNT;

    RETURN v_count;
END;
$$;

-- ============================================================================
-- FUNCTION: check_chargeback_processed
-- Checks if a chargeback has already been processed (idempotency)
-- ============================================================================
CREATE OR REPLACE FUNCTION check_chargeback_processed(p_idempotency_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM commission_adjustments
        WHERE idempotency_key = p_idempotency_key
    ) INTO v_exists;

    RETURN v_exists;
END;
$$;

-- Add voided_at column to commission_ledger for audit trail
ALTER TABLE commission_ledger
ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ;

-- Create index for orphan payment review
CREATE INDEX IF NOT EXISTS idx_payments_review_status_flagged
ON payments(review_status, review_flagged_at)
WHERE review_status = 'pending_review';

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================
GRANT EXECUTE ON FUNCTION lock_payment_for_commission(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION unlock_payment_for_commission(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_is_first_payment(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION void_commission_entries(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_chargeback_processed(TEXT) TO authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON FUNCTION lock_payment_for_commission IS 'Atomically locks a payment for commission calculation. Returns TRUE if lock acquired.';
COMMENT ON FUNCTION unlock_payment_for_commission IS 'Unlocks a payment for recalculation. Returns TRUE if unlocked.';
COMMENT ON FUNCTION check_is_first_payment IS 'Atomically checks if this is the first commission-generating payment for a client.';
COMMENT ON FUNCTION void_commission_entries IS 'Voids all commission entries for a payment (for recalculation). Returns count of voided entries.';
COMMENT ON FUNCTION check_chargeback_processed IS 'Checks if a chargeback has already been processed using idempotency key.';
