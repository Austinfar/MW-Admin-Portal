-- Migration: Add 'No Show' and 'converted' status values to leads table
-- This allows Cal.com webhooks to properly set no-show status and tracks converted leads

-- Drop existing check constraint
ALTER TABLE public.leads
DROP CONSTRAINT IF EXISTS leads_status_check;

-- Add new check constraint with expanded status values
ALTER TABLE public.leads
ADD CONSTRAINT leads_status_check
CHECK (status IN ('New', 'Contacted', 'Appt Set', 'Closed Won', 'Closed Lost', 'No Show', 'converted'));

-- Add comment for documentation
COMMENT ON COLUMN public.leads.status IS 'Lead status: New, Contacted, Appt Set, Closed Won, Closed Lost, No Show, converted';
