-- Client Alerts System
-- Surfaces at-risk client indicators prominently in the dashboard

CREATE TABLE IF NOT EXISTS public.client_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    alert_type TEXT NOT NULL CHECK (alert_type IN (
        'payment_failed',
        'payment_overdue',
        'contract_expiring',
        'onboarding_stalled'
    )),
    severity TEXT NOT NULL CHECK (severity IN ('warning', 'critical')) DEFAULT 'warning',
    title TEXT NOT NULL,
    description TEXT,
    is_dismissed BOOLEAN DEFAULT false,
    dismissed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    dismissed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for efficient queries (active alerts per client)
CREATE INDEX IF NOT EXISTS idx_client_alerts_active
    ON public.client_alerts(client_id, is_dismissed)
    WHERE is_dismissed = false;

-- Index for alert type queries
CREATE INDEX IF NOT EXISTS idx_client_alerts_type
    ON public.client_alerts(alert_type, created_at DESC);

-- Enable RLS
ALTER TABLE public.client_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow authenticated users to read alerts for their clients"
    ON public.client_alerts FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.clients c
            WHERE c.id = client_id
            AND (
                c.assigned_coach_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM public.users u
                    WHERE u.id = auth.uid()
                    AND u.role IN ('admin', 'super_admin')
                )
            )
        )
    );

CREATE POLICY "Allow users to dismiss alerts for their clients"
    ON public.client_alerts FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.clients c
            WHERE c.id = client_id
            AND (
                c.assigned_coach_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM public.users u
                    WHERE u.id = auth.uid()
                    AND u.role IN ('admin', 'super_admin')
                )
            )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.clients c
            WHERE c.id = client_id
            AND (
                c.assigned_coach_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM public.users u
                    WHERE u.id = auth.uid()
                    AND u.role IN ('admin', 'super_admin')
                )
            )
        )
    );

-- Allow system/service role to create alerts (for background jobs)
CREATE POLICY "Allow service role to manage alerts"
    ON public.client_alerts FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Function to generate alerts (can be called by a cron job or trigger)
CREATE OR REPLACE FUNCTION public.generate_client_alerts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_client RECORD;
BEGIN
    -- Clear old non-dismissed alerts that are no longer relevant
    -- (We'll regenerate fresh ones)
    DELETE FROM public.client_alerts
    WHERE is_dismissed = false
    AND created_at < NOW() - INTERVAL '1 day';

    -- Contract expiring alerts (within 14 days)
    FOR v_client IN
        SELECT id, name, contract_end_date
        FROM public.clients
        WHERE status = 'active'
        AND contract_end_date IS NOT NULL
        AND contract_end_date <= CURRENT_DATE + INTERVAL '14 days'
        AND contract_end_date >= CURRENT_DATE
        AND NOT EXISTS (
            SELECT 1 FROM public.client_alerts
            WHERE client_id = clients.id
            AND alert_type = 'contract_expiring'
            AND is_dismissed = false
        )
    LOOP
        INSERT INTO public.client_alerts (client_id, alert_type, severity, title, description)
        VALUES (
            v_client.id,
            'contract_expiring',
            CASE WHEN v_client.contract_end_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'critical' ELSE 'warning' END,
            'Contract Expiring Soon',
            'Contract ends on ' || to_char(v_client.contract_end_date, 'Mon DD, YYYY')
        );
    END LOOP;

    -- Onboarding stalled alerts (tasks overdue by > 7 days)
    FOR v_client IN
        SELECT DISTINCT c.id, c.name
        FROM public.clients c
        INNER JOIN public.client_onboarding_tasks t ON t.client_id = c.id
        WHERE c.status IN ('active', 'onboarding')
        AND t.status = 'pending'
        AND t.due_date < CURRENT_DATE - INTERVAL '7 days'
        AND NOT EXISTS (
            SELECT 1 FROM public.client_alerts
            WHERE client_id = c.id
            AND alert_type = 'onboarding_stalled'
            AND is_dismissed = false
        )
    LOOP
        INSERT INTO public.client_alerts (client_id, alert_type, severity, title, description)
        VALUES (
            v_client.id,
            'onboarding_stalled',
            'warning',
            'Onboarding Stalled',
            'Onboarding tasks are overdue by more than 7 days'
        );
    END LOOP;

    -- Payment failed alerts (within last 7 days)
    FOR v_client IN
        SELECT DISTINCT c.id, c.name
        FROM public.clients c
        INNER JOIN public.payments p ON p.client_id = c.id
        WHERE c.status = 'active'
        AND p.status = 'failed'
        AND p.payment_date >= CURRENT_DATE - INTERVAL '7 days'
        AND NOT EXISTS (
            SELECT 1 FROM public.client_alerts
            WHERE client_id = c.id
            AND alert_type = 'payment_failed'
            AND is_dismissed = false
        )
    LOOP
        INSERT INTO public.client_alerts (client_id, alert_type, severity, title, description)
        VALUES (
            v_client.id,
            'payment_failed',
            'critical',
            'Payment Failed',
            'A recent payment has failed'
        );
    END LOOP;
END;
$$;
