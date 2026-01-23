-- ============================================
-- SUBSCRIPTION MANAGEMENT SYSTEM
-- Adds approval requests, subscription freezes, and extended subscription tracking
-- ============================================

-- 1. Approval Requests Table (for cancellation approvals)
CREATE TABLE IF NOT EXISTS public.approval_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_type TEXT NOT NULL CHECK (request_type IN ('subscription_cancel', 'refund', 'other')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),

    -- Entity references
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    stripe_subscription_id TEXT,

    -- Request details
    requested_by UUID NOT NULL REFERENCES public.users(id),
    requested_at TIMESTAMPTZ DEFAULT now(),
    reason TEXT NOT NULL,
    additional_notes TEXT,

    -- Resolution
    resolved_by UUID REFERENCES public.users(id),
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT,

    -- Metadata for any extra context
    metadata JSONB DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Subscription Freezes Table (for mid-cycle pauses with extension)
CREATE TABLE IF NOT EXISTS public.subscription_freezes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    stripe_subscription_id TEXT NOT NULL,

    -- Freeze details
    freeze_type TEXT NOT NULL CHECK (freeze_type IN ('pause_at_period_end', 'immediate_freeze')),
    freeze_duration_days INTEGER, -- NULL for pause_at_period_end, otherwise 7, 14, or 30

    -- Status tracking
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'resumed', 'cancelled')),

    -- Dates
    started_at TIMESTAMPTZ,
    scheduled_resume_at TIMESTAMPTZ,
    actual_resumed_at TIMESTAMPTZ,

    -- Billing extension tracking (for mid-cycle freeze)
    original_period_end TIMESTAMPTZ,
    extended_period_end TIMESTAMPTZ,

    -- Audit
    created_by UUID NOT NULL REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    resumed_by UUID REFERENCES public.users(id),

    metadata JSONB DEFAULT '{}'::jsonb
);

-- 3. Extend subscriptions table with additional fields for management
DO $$
BEGIN
    -- Add client_id if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'subscriptions' AND column_name = 'client_id') THEN
        ALTER TABLE public.subscriptions ADD COLUMN client_id UUID REFERENCES public.clients(id);
    END IF;

    -- Add plan_name if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'subscriptions' AND column_name = 'plan_name') THEN
        ALTER TABLE public.subscriptions ADD COLUMN plan_name TEXT;
    END IF;

    -- Add next_billing_date if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'subscriptions' AND column_name = 'next_billing_date') THEN
        ALTER TABLE public.subscriptions ADD COLUMN next_billing_date TIMESTAMPTZ;
    END IF;

    -- Add pause_collection_behavior if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'subscriptions' AND column_name = 'pause_collection_behavior') THEN
        ALTER TABLE public.subscriptions ADD COLUMN pause_collection_behavior TEXT;
    END IF;

    -- Add paused_at if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'subscriptions' AND column_name = 'paused_at') THEN
        ALTER TABLE public.subscriptions ADD COLUMN paused_at TIMESTAMPTZ;
    END IF;

    -- Add resume_at if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'subscriptions' AND column_name = 'resume_at') THEN
        ALTER TABLE public.subscriptions ADD COLUMN resume_at TIMESTAMPTZ;
    END IF;

    -- Add cancelled_at if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'subscriptions' AND column_name = 'cancelled_at') THEN
        ALTER TABLE public.subscriptions ADD COLUMN cancelled_at TIMESTAMPTZ;
    END IF;

    -- Add cancellation_reason if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'subscriptions' AND column_name = 'cancellation_reason') THEN
        ALTER TABLE public.subscriptions ADD COLUMN cancellation_reason TEXT;
    END IF;

    -- Add pending_cancellation_request_id if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'subscriptions' AND column_name = 'pending_cancellation_request_id') THEN
        ALTER TABLE public.subscriptions ADD COLUMN pending_cancellation_request_id UUID;
    END IF;
END $$;

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_approval_requests_type ON approval_requests(request_type);
CREATE INDEX IF NOT EXISTS idx_approval_requests_client ON approval_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_requested_by ON approval_requests(requested_by);

CREATE INDEX IF NOT EXISTS idx_subscription_freezes_client ON subscription_freezes(client_id);
CREATE INDEX IF NOT EXISTS idx_subscription_freezes_stripe_sub ON subscription_freezes(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_freezes_status ON subscription_freezes(status);

CREATE INDEX IF NOT EXISTS idx_subscriptions_client ON subscriptions(client_id);

-- ============================================
-- RLS POLICIES
-- ============================================
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_freezes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for re-running migration)
DROP POLICY IF EXISTS "Admins manage approval requests" ON public.approval_requests;
DROP POLICY IF EXISTS "Users view own requests" ON public.approval_requests;
DROP POLICY IF EXISTS "Service role full access approval_requests" ON public.approval_requests;

DROP POLICY IF EXISTS "Admins manage subscription freezes" ON public.subscription_freezes;
DROP POLICY IF EXISTS "Users view client freezes" ON public.subscription_freezes;
DROP POLICY IF EXISTS "Service role full access subscription_freezes" ON public.subscription_freezes;

-- Approval Requests: Admins can manage all, requesters can view own
CREATE POLICY "Admins manage approval requests" ON public.approval_requests
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
    );

CREATE POLICY "Users view own requests" ON public.approval_requests
    FOR SELECT USING (requested_by = auth.uid());

CREATE POLICY "Service role full access approval_requests" ON public.approval_requests
    FOR ALL USING (auth.role() = 'service_role');

-- Subscription Freezes: Admins and head_coach can manage
CREATE POLICY "Admins manage subscription freezes" ON public.subscription_freezes
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
        OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND job_title = 'head_coach')
    );

CREATE POLICY "Users view client freezes" ON public.subscription_freezes
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM clients
            WHERE clients.id = subscription_freezes.client_id
            AND clients.assigned_coach_id = auth.uid()
        )
    );

CREATE POLICY "Service role full access subscription_freezes" ON public.subscription_freezes
    FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- TRIGGERS
-- ============================================

-- Create update trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add update trigger for approval_requests
DROP TRIGGER IF EXISTS update_approval_requests_updated_at ON public.approval_requests;
CREATE TRIGGER update_approval_requests_updated_at
    BEFORE UPDATE ON public.approval_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE public.approval_requests IS 'Tracks approval requests for subscription cancellations and other admin-requiring actions';
COMMENT ON TABLE public.subscription_freezes IS 'Tracks subscription pause/freeze requests including mid-cycle freezes with billing extension';
COMMENT ON COLUMN public.subscription_freezes.freeze_duration_days IS '7=1 week, 14=2 weeks, 30=1 month. NULL for pause_at_period_end';
COMMENT ON COLUMN public.subscription_freezes.extended_period_end IS 'For immediate freezes: original end + freeze duration';
