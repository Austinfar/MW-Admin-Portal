-- Add 'canceled' value to payment_schedule_status enum
-- This allows payment schedules to be marked as canceled

ALTER TYPE payment_schedule_status ADD VALUE IF NOT EXISTS 'canceled';

-- Also add to scheduled_charge_status enum if it exists
DO $$
BEGIN
    ALTER TYPE scheduled_charge_status ADD VALUE IF NOT EXISTS 'canceled';
EXCEPTION
    WHEN undefined_object THEN
        -- enum doesn't exist, ignore
        NULL;
END $$;

COMMENT ON TYPE payment_schedule_status IS 'Status values: draft, pending_initial, active, completed, expired, canceled';
