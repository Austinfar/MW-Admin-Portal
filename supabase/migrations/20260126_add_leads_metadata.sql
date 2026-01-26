-- Add metadata and questionnaire_status to leads table
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS questionnaire_status TEXT DEFAULT 'pending';

-- Add check constraint for questionnaire_status if desired (optional, but good practice)
-- ALTER TABLE public.leads ADD CONSTRAINT check_questionnaire_status CHECK (questionnaire_status IN ('pending', 'completed', 'in_progress'));
