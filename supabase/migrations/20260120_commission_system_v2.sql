-- Commission System V2 Migration
-- Adds: payroll runs, adjustments, setter tracking, coach history, orphan payment review

-- ============================================
-- 1. PAYROLL RUNS TABLE (for managing pay periods)
-- ============================================
CREATE TABLE IF NOT EXISTS public.payroll_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    payout_date DATE NOT NULL,
    status TEXT CHECK (status IN ('draft', 'approved', 'paid', 'void')) DEFAULT 'draft',

    -- Calculated totals
    total_commission DECIMAL DEFAULT 0,
    total_adjustments DECIMAL DEFAULT 0,
    total_payout DECIMAL DEFAULT 0,
    transaction_count INTEGER DEFAULT 0,

    -- Audit trail
    created_by UUID REFERENCES public.users(id) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    approved_by UUID REFERENCES public.users(id),
    approved_at TIMESTAMPTZ,
    paid_by UUID REFERENCES public.users(id),
    paid_at TIMESTAMPTZ,
    voided_by UUID REFERENCES public.users(id),
    voided_at TIMESTAMPTZ,
    void_reason TEXT,
    notes TEXT,

    -- Two-person approval rule
    CONSTRAINT different_approver CHECK (created_by IS DISTINCT FROM approved_by),
    CONSTRAINT unique_period UNIQUE (period_start, period_end)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_payroll_runs_status ON payroll_runs(status);
CREATE INDEX IF NOT EXISTS idx_payroll_runs_dates ON payroll_runs(period_start, period_end);

-- ============================================
-- 2. COMMISSION ADJUSTMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.commission_adjustments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payroll_run_id UUID REFERENCES public.payroll_runs(id),
    user_id UUID REFERENCES public.users(id) NOT NULL,

    -- Amount: positive = bonus, negative = deduction
    amount DECIMAL NOT NULL,

    adjustment_type TEXT CHECK (adjustment_type IN (
        'bonus',           -- Discretionary bonus
        'deduction',       -- General deduction
        'correction',      -- Fix to previous calculation
        'chargeback',      -- Stripe refund/dispute
        'referral'         -- Referral bonus
    )) NOT NULL,

    reason TEXT NOT NULL,
    notes TEXT,

    -- Link to original transaction (for chargebacks/corrections)
    related_ledger_id UUID REFERENCES public.commission_ledger(id),
    related_payment_id UUID REFERENCES public.payments(id),

    -- Audit
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),

    -- Visibility: Coaches see adjustments affecting them
    is_visible_to_user BOOLEAN DEFAULT true
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_commission_adjustments_user ON commission_adjustments(user_id);
CREATE INDEX IF NOT EXISTS idx_commission_adjustments_run ON commission_adjustments(payroll_run_id);
CREATE INDEX IF NOT EXISTS idx_commission_adjustments_type ON commission_adjustments(adjustment_type);

-- ============================================
-- 3. ALTER COMMISSION_LEDGER
-- ============================================

-- Drop the UNIQUE constraint on payment_id to allow multiple splits per payment
ALTER TABLE public.commission_ledger
    DROP CONSTRAINT IF EXISTS commission_ledger_payment_id_key;

-- Add new columns for split tracking and payroll linking
ALTER TABLE public.commission_ledger
    ADD COLUMN IF NOT EXISTS payroll_run_id UUID REFERENCES public.payroll_runs(id),
    ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS entry_type TEXT CHECK (entry_type IN ('commission', 'split', 'manual', 'import')) DEFAULT 'commission',
    ADD COLUMN IF NOT EXISTS split_role TEXT,
    ADD COLUMN IF NOT EXISTS split_percentage DECIMAL,
    ADD COLUMN IF NOT EXISTS source_schedule_id UUID;

-- Add composite unique constraint (one entry per user per payment)
-- Using DO block to handle if constraint already exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'unique_user_payment'
    ) THEN
        ALTER TABLE public.commission_ledger
            ADD CONSTRAINT unique_user_payment UNIQUE (user_id, payment_id);
    END IF;
EXCEPTION WHEN duplicate_object THEN
    -- Constraint already exists
    NULL;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_commission_ledger_run ON commission_ledger(payroll_run_id);
CREATE INDEX IF NOT EXISTS idx_commission_ledger_period ON commission_ledger(payout_period_start);
CREATE INDEX IF NOT EXISTS idx_commission_ledger_status ON commission_ledger(status);
CREATE INDEX IF NOT EXISTS idx_commission_ledger_entry_type ON commission_ledger(entry_type);

-- ============================================
-- 4. ALTER PAYMENTS TABLE (refund/dispute tracking, orphan review)
-- ============================================
ALTER TABLE public.payments
    ADD COLUMN IF NOT EXISTS refund_amount DECIMAL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS refund_reason TEXT,
    ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS dispute_status TEXT CHECK (dispute_status IN (
        'warning_needs_response', 'warning_under_review', 'warning_closed',
        'needs_response', 'under_review', 'won', 'lost'
    )),
    ADD COLUMN IF NOT EXISTS dispute_id TEXT,
    ADD COLUMN IF NOT EXISTS review_status TEXT CHECK (review_status IN ('pending_review', 'matched', 'excluded')),
    ADD COLUMN IF NOT EXISTS review_notes TEXT;

-- Update status check to include new statuses
-- First drop old constraint if exists, then add new one
DO $$
BEGIN
    ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_status_check;
    ALTER TABLE public.payments
        ADD CONSTRAINT payments_status_check
        CHECK (status IN ('succeeded', 'failed', 'refunded', 'partially_refunded', 'disputed', 'pending'));
EXCEPTION WHEN others THEN
    -- Constraint might not exist or have different name
    NULL;
END $$;

-- Index for orphan payment review
CREATE INDEX IF NOT EXISTS idx_payments_review_status ON payments(review_status) WHERE review_status IS NOT NULL;

-- ============================================
-- 5. ALTER LEADS TABLE (appointment setter tracking)
-- ============================================
ALTER TABLE public.leads
    ADD COLUMN IF NOT EXISTS booked_by_user_id UUID REFERENCES public.users(id);

COMMENT ON COLUMN public.leads.booked_by_user_id IS 'Appointment setter who booked the call';

-- ============================================
-- 6. ALTER CLIENTS TABLE (setter + coach history tracking)
-- ============================================
ALTER TABLE public.clients
    ADD COLUMN IF NOT EXISTS appointment_setter_id UUID REFERENCES public.users(id),
    ADD COLUMN IF NOT EXISTS coach_history JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.clients.appointment_setter_id IS 'Appointment setter who booked the original call (copied from lead)';
COMMENT ON COLUMN public.clients.coach_history IS 'Array of {coach_id, start_date, end_date} for tracking coach transitions';

-- ============================================
-- 7. SUBSCRIPTION COMMISSION CONFIG (for legacy Stripe subscriptions)
-- ============================================
CREATE TABLE IF NOT EXISTS public.subscription_commission_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stripe_subscription_id TEXT UNIQUE NOT NULL,
    client_id UUID REFERENCES public.clients(id),
    assigned_coach_id UUID REFERENCES public.users(id),
    appointment_setter_id UUID REFERENCES public.users(id),
    commission_splits JSONB DEFAULT '[]'::jsonb,
    lead_source TEXT CHECK (lead_source IN ('coach_driven', 'company_driven')),
    is_resign BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.subscription_commission_config IS 'Commission configuration for legacy Stripe subscriptions not created through payment links';

CREATE INDEX IF NOT EXISTS idx_sub_commission_config_sub_id ON subscription_commission_config(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_sub_commission_config_client ON subscription_commission_config(client_id);

-- ============================================
-- 8. EXTEND NOTIFICATIONS FOR COMMISSIONS
-- ============================================

-- Add category to feature_notifications to support commission notifications
ALTER TABLE public.feature_notifications
    ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'feature_request';

-- Add commission-related notification types
DO $$
BEGIN
    -- Try to alter the type enum if it exists
    ALTER TABLE public.feature_notifications
        DROP CONSTRAINT IF EXISTS feature_notifications_type_check;

    ALTER TABLE public.feature_notifications
        ADD CONSTRAINT feature_notifications_type_check
        CHECK (type IN (
            'status_change', 'new_comment', 'mention', 'completed',
            'commission_earned', 'payroll_approved', 'payroll_paid',
            'adjustment_added', 'chargeback'
        ));
EXCEPTION WHEN others THEN
    -- Type column might have different constraint mechanism
    NULL;
END $$;

-- Add commission-specific columns to notifications
ALTER TABLE public.feature_notifications
    ADD COLUMN IF NOT EXISTS commission_ledger_id UUID REFERENCES public.commission_ledger(id),
    ADD COLUMN IF NOT EXISTS payroll_run_id UUID REFERENCES public.payroll_runs(id),
    ADD COLUMN IF NOT EXISTS amount DECIMAL;

-- ============================================
-- 9. RLS POLICIES
-- ============================================

-- Payroll Runs RLS
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage payroll runs" ON public.payroll_runs
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
    );

CREATE POLICY "Users view relevant payroll runs" ON public.payroll_runs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM commission_ledger
            WHERE commission_ledger.payroll_run_id = payroll_runs.id
            AND commission_ledger.user_id = auth.uid()
        )
    );

-- Commission Adjustments RLS
ALTER TABLE public.commission_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage adjustments" ON public.commission_adjustments
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
    );

CREATE POLICY "Users view own adjustments" ON public.commission_adjustments
    FOR SELECT USING (
        user_id = auth.uid() AND is_visible_to_user = true
    );

-- Subscription Commission Config RLS
ALTER TABLE public.subscription_commission_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage subscription config" ON public.subscription_commission_config
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
    );

-- ============================================
-- 10. TRIGGERS
-- ============================================

-- Update coach_history when assigned_coach_id changes
CREATE OR REPLACE FUNCTION track_coach_history()
RETURNS TRIGGER AS $$
BEGIN
    -- Only track if coach actually changed and new coach is not null
    IF OLD.assigned_coach_id IS DISTINCT FROM NEW.assigned_coach_id AND NEW.assigned_coach_id IS NOT NULL THEN
        -- Close out the previous coach's entry
        IF OLD.assigned_coach_id IS NOT NULL THEN
            NEW.coach_history = (
                SELECT jsonb_agg(
                    CASE
                        WHEN (entry->>'coach_id')::uuid = OLD.assigned_coach_id AND entry->>'end_date' IS NULL
                        THEN jsonb_set(entry, '{end_date}', to_jsonb(CURRENT_DATE::text))
                        ELSE entry
                    END
                )
                FROM jsonb_array_elements(COALESCE(OLD.coach_history, '[]'::jsonb)) AS entry
            );
            -- Handle case where coach_history was empty or null
            IF NEW.coach_history IS NULL THEN
                NEW.coach_history = '[]'::jsonb;
            END IF;
        END IF;

        -- Add new coach entry
        NEW.coach_history = COALESCE(NEW.coach_history, '[]'::jsonb) || jsonb_build_array(
            jsonb_build_object(
                'coach_id', NEW.assigned_coach_id,
                'start_date', CURRENT_DATE::text,
                'end_date', null
            )
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS track_coach_history_trigger ON public.clients;
CREATE TRIGGER track_coach_history_trigger
    BEFORE UPDATE ON public.clients
    FOR EACH ROW
    EXECUTE FUNCTION track_coach_history();

-- Trigger to update subscription_commission_config updated_at
CREATE TRIGGER update_subscription_commission_config_updated_at
    BEFORE UPDATE ON public.subscription_commission_config
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ============================================
-- 11. SEED DEFAULT COMMISSION SETTINGS (if not exist)
-- ============================================
INSERT INTO public.commission_settings (setting_key, setting_value, description)
VALUES
    ('commission_rate_company_lead', 0.50, 'Commission rate for company-sourced leads (50%)'),
    ('commission_rate_coach_lead', 0.70, 'Commission rate for coach-sourced leads (70%)'),
    ('commission_rate_resign', 0.70, 'Commission rate for re-signed clients (70%)'),
    ('closer_rate', 0.10, 'Sales closer commission rate (10% of gross)'),
    ('setter_rate', 0.10, 'Appointment setter commission rate (10% of gross)'),
    ('referrer_flat_fee', 100.00, 'Flat fee for referrers ($100)')
ON CONFLICT (setting_key) DO NOTHING;
