-- Client Goals & Milestones System
-- Allows coaches to track client goals with progress indicators

CREATE TABLE IF NOT EXISTS public.client_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    goal_type TEXT NOT NULL CHECK (goal_type IN ('outcome', 'habit', 'milestone')),
    target_value DECIMAL,
    target_unit TEXT,
    current_value DECIMAL DEFAULT 0,
    target_date DATE,
    status TEXT NOT NULL CHECK (status IN ('active', 'achieved', 'abandoned')) DEFAULT 'active',
    priority INTEGER DEFAULT 0,
    achieved_at TIMESTAMPTZ,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_client_goals_client_id ON public.client_goals(client_id);
CREATE INDEX IF NOT EXISTS idx_client_goals_status ON public.client_goals(status);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_client_goals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_client_goals_updated_at ON public.client_goals;
CREATE TRIGGER trigger_client_goals_updated_at
    BEFORE UPDATE ON public.client_goals
    FOR EACH ROW
    EXECUTE FUNCTION update_client_goals_updated_at();

-- Enable RLS
ALTER TABLE public.client_goals ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow users to read goals for their clients"
    ON public.client_goals FOR SELECT
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

CREATE POLICY "Allow users to manage goals for their clients"
    ON public.client_goals FOR ALL
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
