-- Migration: Add program_term and lead_id columns to payment_schedules table
-- program_term: stores the program length (6 or 12 months) for each payment link
-- lead_id: links payment schedule to a lead (for pre-client payments)

ALTER TABLE payment_schedules 
ADD COLUMN IF NOT EXISTS program_term TEXT DEFAULT '6';

ALTER TABLE payment_schedules 
ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES leads(id);

COMMENT ON COLUMN payment_schedules.program_term IS 'Program term in months: 6 or 12';
COMMENT ON COLUMN payment_schedules.lead_id IS 'Link to lead (for pre-client payment links)';
