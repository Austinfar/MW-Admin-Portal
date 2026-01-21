-- ============================================
-- CLIENT AGREEMENTS TRACKING SYSTEM
-- ============================================
-- Tracks coaching agreements sent via GHL Documents
-- with full status lifecycle management

-- 1. Create client_agreements table
CREATE TABLE IF NOT EXISTS public.client_agreements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,

    -- GHL Document tracking
    ghl_document_id TEXT,                    -- GHL's document ID for API calls
    template_id TEXT NOT NULL,               -- Which agreement template was used
    template_name TEXT,                      -- Human-readable template name

    -- Status lifecycle
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
        'draft',      -- Created but not sent
        'sent',       -- Sent to client, awaiting signature
        'viewed',     -- Client has viewed the document
        'signed',     -- Client has signed
        'voided',     -- Agreement was cancelled/voided
        'expired'     -- Agreement expired without signature
    )),

    -- Timestamps for each status
    sent_at TIMESTAMPTZ,
    viewed_at TIMESTAMPTZ,
    signed_at TIMESTAMPTZ,
    voided_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,                  -- When the agreement expires if unsigned

    -- Void details
    voided_reason TEXT,
    voided_by UUID REFERENCES public.users(id) ON DELETE SET NULL,

    -- Signed document storage
    signed_document_url TEXT,                -- URL to signed PDF
    signed_document_storage_path TEXT,       -- Local storage path if we download it

    -- Audit trail
    sent_by UUID REFERENCES public.users(id) ON DELETE SET NULL,

    -- Additional metadata from GHL
    metadata JSONB DEFAULT '{}',             -- IP address, user agent, signer details

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_client_agreements_client
    ON public.client_agreements(client_id);

CREATE INDEX IF NOT EXISTS idx_client_agreements_status
    ON public.client_agreements(status);

CREATE INDEX IF NOT EXISTS idx_client_agreements_ghl_doc
    ON public.client_agreements(ghl_document_id)
    WHERE ghl_document_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_client_agreements_pending
    ON public.client_agreements(client_id, status)
    WHERE status IN ('sent', 'viewed');

-- 3. RLS Policies
ALTER TABLE public.client_agreements ENABLE ROW LEVEL SECURITY;

-- Coaches can view agreements for their clients
CREATE POLICY "Coaches can view client agreements" ON public.client_agreements
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM clients c
            WHERE c.id = client_agreements.client_id
            AND c.assigned_coach_id = auth.uid()
        )
    );

-- Admins can view all agreements
CREATE POLICY "Admins can view all agreements" ON public.client_agreements
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()
            AND role IN ('admin', 'super_admin')
        )
    );

-- Admins can manage agreements
CREATE POLICY "Admins can manage agreements" ON public.client_agreements
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()
            AND role IN ('admin', 'super_admin')
        )
    );

-- Coaches can send agreements for their clients
CREATE POLICY "Coaches can create agreements for their clients" ON public.client_agreements
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM clients c
            WHERE c.id = client_agreements.client_id
            AND c.assigned_coach_id = auth.uid()
        )
    );

-- System can update agreements (for webhooks)
CREATE POLICY "System can update agreements" ON public.client_agreements
    FOR UPDATE USING (true);

-- 4. Update timestamp trigger
CREATE TRIGGER trigger_client_agreements_updated_at
    BEFORE UPDATE ON public.client_agreements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 5. Function to get the latest active agreement for a client
CREATE OR REPLACE FUNCTION get_active_agreement(p_client_id UUID)
RETURNS TABLE (
    id UUID,
    status TEXT,
    sent_at TIMESTAMPTZ,
    signed_at TIMESTAMPTZ,
    template_name TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ca.id,
        ca.status,
        ca.sent_at,
        ca.signed_at,
        ca.template_name
    FROM client_agreements ca
    WHERE ca.client_id = p_client_id
    AND ca.status NOT IN ('voided', 'expired')
    ORDER BY ca.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
