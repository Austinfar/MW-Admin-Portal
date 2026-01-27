-- Add is_priority flag and ghl_contact_id to leads table

-- Add is_priority column for hot lead flagging
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS is_priority BOOLEAN DEFAULT false;

-- Add ghl_contact_id for GHL sync (if not exists)
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS ghl_contact_id TEXT;

-- Create index on is_priority for faster filtering
CREATE INDEX IF NOT EXISTS idx_leads_is_priority ON public.leads(is_priority) WHERE is_priority = true;

-- Create unique index on ghl_contact_id for upsert operations
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_ghl_contact_id ON public.leads(ghl_contact_id) WHERE ghl_contact_id IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.leads.is_priority IS 'Priority/Hot Lead flag - leads marked for urgent attention';
COMMENT ON COLUMN public.leads.ghl_contact_id IS 'GoHighLevel contact ID for CRM sync';
