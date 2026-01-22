-- Client Documents System
-- Allows coaches to upload and manage client-specific documents

CREATE TABLE IF NOT EXISTS public.client_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    document_type TEXT NOT NULL CHECK (document_type IN (
        'meal_plan',
        'workout_program',
        'intake_form',
        'contract',
        'other'
    )),
    storage_path TEXT NOT NULL,
    file_size INTEGER,
    mime_type TEXT,
    uploaded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    is_shared_with_client BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_client_documents_client_id ON public.client_documents(client_id);
CREATE INDEX IF NOT EXISTS idx_client_documents_type ON public.client_documents(document_type);

-- Enable RLS
ALTER TABLE public.client_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow users to read documents for their clients"
    ON public.client_documents FOR SELECT
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

CREATE POLICY "Allow users to manage documents for their clients"
    ON public.client_documents FOR ALL
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

-- Create storage bucket for client documents (run via Supabase dashboard or separate script)
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('client-documents', 'client-documents', false)
-- ON CONFLICT DO NOTHING;

-- Storage RLS policies would be:
-- CREATE POLICY "Users can upload client documents"
--     ON storage.objects FOR INSERT
--     TO authenticated
--     WITH CHECK (bucket_id = 'client-documents');
--
-- CREATE POLICY "Users can view client documents"
--     ON storage.objects FOR SELECT
--     TO authenticated
--     USING (bucket_id = 'client-documents');
--
-- CREATE POLICY "Users can delete their uploaded documents"
--     ON storage.objects FOR DELETE
--     TO authenticated
--     USING (bucket_id = 'client-documents');
