
-- Reconstruct feature_notifications table based on usage in payroll.ts and feature-requests.ts
CREATE TABLE IF NOT EXISTS public.feature_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    category TEXT NOT NULL, -- 'commission', 'roadmap', etc.
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    amount NUMERIC, 
    request_id UUID REFERENCES public.feature_requests(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.feature_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications" ON public.feature_notifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System/Admins can manage notifications" ON public.feature_notifications
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
        OR auth.role() = 'service_role'
    );

-- Index
CREATE INDEX IF NOT EXISTS idx_feature_notifications_user_unread 
    ON public.feature_notifications(user_id) 
    WHERE is_read = false;
