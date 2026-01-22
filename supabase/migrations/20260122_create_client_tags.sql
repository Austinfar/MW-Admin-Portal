-- Client Tags System
-- Allows coaches to categorize clients with custom tags

-- Tags table
CREATE TABLE IF NOT EXISTS public.client_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    color TEXT DEFAULT 'gray', -- tailwind color name: red, blue, green, amber, purple, etc.
    description TEXT,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Tag assignments (many-to-many relationship)
CREATE TABLE IF NOT EXISTS public.client_tag_assignments (
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES public.client_tags(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (client_id, tag_id)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_client_tag_assignments_client_id ON public.client_tag_assignments(client_id);
CREATE INDEX IF NOT EXISTS idx_client_tag_assignments_tag_id ON public.client_tag_assignments(tag_id);

-- Insert predefined tags
INSERT INTO public.client_tags (name, color, description) VALUES
    ('VIP', 'amber', 'High-value or priority client'),
    ('Needs Support', 'red', 'Client requiring additional attention'),
    ('At Risk', 'red', 'Client showing signs of potential churn'),
    ('Referral Source', 'blue', 'Client who refers other clients'),
    ('Re-sign Candidate', 'green', 'Client likely to renew contract')
ON CONFLICT (name) DO NOTHING;

-- Enable RLS
ALTER TABLE public.client_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_tag_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for client_tags
CREATE POLICY "Allow authenticated users to read tags"
    ON public.client_tags FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow admins to manage tags"
    ON public.client_tags FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND role IN ('admin', 'super_admin')
        )
    );

-- RLS Policies for client_tag_assignments
CREATE POLICY "Allow authenticated users to read tag assignments"
    ON public.client_tag_assignments FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow coaches to manage their clients tags"
    ON public.client_tag_assignments FOR ALL
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
