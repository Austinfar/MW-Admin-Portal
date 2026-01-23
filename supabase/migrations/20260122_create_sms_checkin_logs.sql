-- SMS Check-in Logs table for tracking weekly check-in messages
CREATE TABLE IF NOT EXISTS public.sms_checkin_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    ghl_contact_id TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    error_message TEXT,
    sent_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for duplicate prevention (one SMS per client per day)
CREATE UNIQUE INDEX IF NOT EXISTS idx_sms_checkin_logs_client_day
    ON public.sms_checkin_logs(client_id, DATE(sent_at));

-- Index for querying by date
CREATE INDEX IF NOT EXISTS idx_sms_checkin_logs_sent_at
    ON public.sms_checkin_logs(sent_at);

-- RLS
ALTER TABLE public.sms_checkin_logs ENABLE ROW LEVEL SECURITY;

-- Service role can manage SMS logs (for cron job)
CREATE POLICY "Service role can manage SMS logs" ON public.sms_checkin_logs
    FOR ALL USING (true);

-- Admins can view all SMS logs
CREATE POLICY "Admins can view SMS logs" ON public.sms_checkin_logs
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
    );

-- Insert default SMS check-in settings
INSERT INTO public.app_settings (key, value, updated_at)
VALUES
    ('sms_checkin_enabled', 'true', now()),
    ('sms_checkin_message_template', 'Hey {firstName}! Just checking in - how''s your week going? Let us know if you need anything!', now())
ON CONFLICT (key) DO NOTHING;
