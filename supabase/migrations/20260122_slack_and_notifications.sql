-- ============================================
-- SLACK INTEGRATION & ENHANCED NOTIFICATIONS
-- ============================================

-- 1. Add Slack user ID to users table
ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS slack_user_id TEXT;

COMMENT ON COLUMN public.users.slack_user_id IS 'Slack member ID for sending DMs (e.g., U0G9QF9C6)';

CREATE INDEX IF NOT EXISTS idx_users_slack_user_id
    ON public.users(slack_user_id)
    WHERE slack_user_id IS NOT NULL;

-- 2. Add target_role column for role-based broadcast notifications
ALTER TABLE public.feature_notifications
    ADD COLUMN IF NOT EXISTS target_role TEXT;

COMMENT ON COLUMN public.feature_notifications.target_role IS 'If set, notification targets all users with this role (admin, super_admin, coach, etc.)';

CREATE INDEX IF NOT EXISTS idx_feature_notifications_target_role
    ON public.feature_notifications(target_role)
    WHERE target_role IS NOT NULL;

-- 3. Extend notification types to include new sale/onboarding types
ALTER TABLE public.feature_notifications
    DROP CONSTRAINT IF EXISTS feature_notifications_type_check;

ALTER TABLE public.feature_notifications
    ADD CONSTRAINT feature_notifications_type_check
    CHECK (type IN (
        -- Existing feature request types
        'status_change', 'new_comment', 'mention', 'completed',
        -- Existing commission types
        'commission_earned', 'payroll_approved', 'payroll_paid',
        'adjustment_added', 'chargeback', 'orphan_payment',
        -- New sale/onboarding types
        'sale_closed',           -- Sale completed notification
        'new_client_assigned',   -- Coach gets new client
        'pipeline_failure',      -- Admin alert for post-payment flow failures
        'agreement_sent',        -- Agreement was sent to client
        'agreement_signed'       -- Agreement was signed by client
    ));

-- 4. Create webhook job queue for retry mechanism
CREATE TABLE IF NOT EXISTS public.webhook_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type TEXT NOT NULL CHECK (job_type IN ('slack_channel', 'slack_dm')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'dead')),
    payload JSONB NOT NULL,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    next_retry_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_jobs_status
    ON public.webhook_jobs(status)
    WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_webhook_jobs_retry
    ON public.webhook_jobs(next_retry_at)
    WHERE status = 'pending' AND next_retry_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_webhook_jobs_client
    ON public.webhook_jobs(client_id);

-- RLS for webhook_jobs
ALTER TABLE public.webhook_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view webhook jobs" ON public.webhook_jobs
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
    );

CREATE POLICY "System can manage webhook jobs" ON public.webhook_jobs
    FOR ALL USING (true);

-- 5. Update timestamp trigger for webhook_jobs
CREATE TRIGGER trigger_webhook_jobs_updated_at
    BEFORE UPDATE ON public.webhook_jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
