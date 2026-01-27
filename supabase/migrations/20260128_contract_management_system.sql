-- Contract Management System Migration
-- Adds contract history tracking, renewal fields, and GHL contract variable support

-- ============================================================================
-- PHASE 1: Fix Contract End Date (remove generated column)
-- ============================================================================

-- Drop the generated column and recreate as regular column
ALTER TABLE public.clients DROP COLUMN IF EXISTS contract_end_date;
ALTER TABLE public.clients ADD COLUMN contract_end_date DATE;

-- Backfill existing clients (default 6 months from start_date)
UPDATE public.clients
SET contract_end_date = start_date + INTERVAL '6 months'
WHERE contract_end_date IS NULL AND start_date IS NOT NULL;

-- ============================================================================
-- PHASE 2: Add Renewal Tracking Fields to Clients
-- ============================================================================

-- Renewal status tracking
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS renewal_status TEXT DEFAULT 'pending';

-- Add check constraint separately (more compatible)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'clients_renewal_status_check'
    ) THEN
        ALTER TABLE public.clients
        ADD CONSTRAINT clients_renewal_status_check
        CHECK (renewal_status IN ('pending', 'renewed', 'churned', 'in_discussion'));
    END IF;
END $$;

-- Track which reminder notifications have been sent
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS renewal_reminders_sent JSONB DEFAULT '{"30_day": null, "14_day": null, "7_day": null}'::jsonb;

-- Program term stored on client for reference
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS program_term_months INTEGER DEFAULT 6;

-- ============================================================================
-- PHASE 3: Create Contract History Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.client_contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    contract_number INTEGER NOT NULL DEFAULT 1,  -- 1, 2, 3... for each renewal

    -- Dates
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,

    -- Program Details
    program_name TEXT NOT NULL,
    program_term_months INTEGER NOT NULL DEFAULT 6,

    -- Payment Info (from payment_schedule OR manual entry)
    payment_schedule_id UUID REFERENCES public.payment_schedules(id) ON DELETE SET NULL,
    payment_type TEXT, -- 'paid_in_full' | 'split_pay' | 'monthly'
    total_value DECIMAL(10,2),
    monthly_rate DECIMAL(10,2),
    down_payment DECIMAL(10,2),
    installment_count INTEGER,
    installment_amount DECIMAL(10,2),
    payment_collection_method TEXT, -- 'payment_link' | 'card_on_file' | 'manual' (how payment was collected)

    -- Manual Entry Fields (when no payment_schedule)
    manual_entry BOOLEAN DEFAULT false,
    manual_notes TEXT,

    -- Links to agreement (set when agreement is sent)
    agreement_id UUID REFERENCES public.client_agreements(id) ON DELETE SET NULL,

    -- Status
    status TEXT NOT NULL DEFAULT 'active',

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    CONSTRAINT client_contracts_status_check
        CHECK (status IN ('active', 'completed', 'cancelled')),
    CONSTRAINT client_contracts_unique_number
        UNIQUE(client_id, contract_number)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_client_contracts_client
    ON public.client_contracts(client_id);
CREATE INDEX IF NOT EXISTS idx_client_contracts_active
    ON public.client_contracts(client_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_client_contracts_end_date
    ON public.client_contracts(end_date) WHERE status = 'active';

-- ============================================================================
-- PHASE 4: Extend Client Agreements Table
-- ============================================================================

-- Store the contract variables that were pushed to GHL
ALTER TABLE public.client_agreements
ADD COLUMN IF NOT EXISTS contract_variables JSONB DEFAULT '{}'::jsonb;

-- Link agreement to specific client_contract
ALTER TABLE public.client_agreements
ADD COLUMN IF NOT EXISTS client_contract_id UUID REFERENCES public.client_contracts(id) ON DELETE SET NULL;

-- ============================================================================
-- PHASE 5: Add current_contract_id to Clients for Quick Access
-- ============================================================================

ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS current_contract_id UUID REFERENCES public.client_contracts(id) ON DELETE SET NULL;

-- ============================================================================
-- PHASE 6: Create Trigger for updated_at on client_contracts
-- ============================================================================

-- Create the trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for client_contracts
DROP TRIGGER IF EXISTS update_client_contracts_updated_at ON public.client_contracts;
CREATE TRIGGER update_client_contracts_updated_at
    BEFORE UPDATE ON public.client_contracts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PHASE 7: RLS Policies for client_contracts
-- ============================================================================

-- Enable RLS
ALTER TABLE public.client_contracts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view contracts for clients they can view
CREATE POLICY "Users can view contracts for their clients"
    ON public.client_contracts
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.clients c
            WHERE c.id = client_contracts.client_id
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

-- Policy: Admins can insert contracts
CREATE POLICY "Admins can insert contracts"
    ON public.client_contracts
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid()
            AND u.role IN ('admin', 'super_admin', 'coach', 'head_coach')
        )
    );

-- Policy: Admins can update contracts
CREATE POLICY "Admins can update contracts"
    ON public.client_contracts
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid()
            AND u.role IN ('admin', 'super_admin', 'head_coach')
        )
    );

-- Policy: Service role bypasses RLS (for webhooks and server actions)
CREATE POLICY "Service role has full access to contracts"
    ON public.client_contracts
    FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================================================
-- PHASE 8: Backfill client_contracts for existing clients
-- ============================================================================

-- Create initial contract records for existing active clients
-- Only if they don't already have a contract record
INSERT INTO public.client_contracts (
    client_id,
    contract_number,
    start_date,
    end_date,
    program_name,
    program_term_months,
    status
)
SELECT
    c.id,
    1,
    c.start_date,
    COALESCE(c.contract_end_date, c.start_date + INTERVAL '6 months'),
    COALESCE(ct.name, 'Coaching Program'),
    COALESCE(c.program_term_months, 6),
    CASE
        WHEN c.status = 'active' THEN 'active'
        ELSE 'completed'
    END
FROM public.clients c
LEFT JOIN public.client_types ct ON c.client_type_id = ct.id
WHERE NOT EXISTS (
    SELECT 1 FROM public.client_contracts cc WHERE cc.client_id = c.id
)
AND c.start_date IS NOT NULL;

-- Update current_contract_id for existing clients
UPDATE public.clients c
SET current_contract_id = (
    SELECT cc.id
    FROM public.client_contracts cc
    WHERE cc.client_id = c.id
    AND cc.status = 'active'
    ORDER BY cc.contract_number DESC
    LIMIT 1
)
WHERE c.current_contract_id IS NULL;

-- ============================================================================
-- Done!
-- ============================================================================
