-- Migration: Setup for Payment-to-Onboarding Automation
-- 1. Create activity_logs table for unified history
-- 2. Add client_type_id to payment_schedules
-- 3. Seed default onboarding template

-- 1. Create activity_logs
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    type TEXT NOT NULL, -- 'note', 'call', 'email', 'status_change', 'payment', 'onboarding', 'conversion'
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Indexes for activity logs
CREATE INDEX IF NOT EXISTS idx_activity_logs_lead_id ON public.activity_logs(lead_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_client_id ON public.activity_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at DESC);

-- RLS Policies for activity_logs
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view activities for leads/clients they have access to" 
ON public.activity_logs FOR SELECT 
USING (
    -- Simplified: Allow authenticated users to view logs for now. 
    -- Complex logic would mirror clients/leads policies if needed.
    auth.role() = 'authenticated'
);

CREATE POLICY "Users can insert activities" 
ON public.activity_logs FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');


-- 2. Update payment_schedules
ALTER TABLE public.payment_schedules 
ADD COLUMN IF NOT EXISTS client_type_id UUID REFERENCES public.client_types(id);

COMMENT ON COLUMN public.payment_schedules.client_type_id IS 'Link to the Program (Client Type) purchased';


-- 3. Seed "Standard Onboarding" Template if it doesn't exist
DO $$
DECLARE
    v_template_id UUID;
BEGIN
    -- Check if template exists
    SELECT id INTO v_template_id FROM public.onboarding_templates WHERE name = 'Standard Onboarding';
    
    -- If not, create it
    IF v_template_id IS NULL THEN
        INSERT INTO public.onboarding_templates (name, description)
        VALUES ('Standard Onboarding', 'Default onboarding tasks for new clients')
        RETURNING id INTO v_template_id;
        
        -- Seed standard tasks linked to this template
        INSERT INTO public.onboarding_task_templates (template_id, title, description, due_offset_days, display_order, is_required)
        VALUES 
            (v_template_id, 'Sign Service Agreement', 'Please sign the service agreement sent to your email.', 0, 1, true),
            (v_template_id, 'Complete Initial Questionnaire', 'Fill out the initial onboarding form.', 1, 2, true),
            (v_template_id, 'Upload Progress Photos', 'Upload your starting point photos.', 2, 3, true),
            (v_template_id, 'Join Community Group', 'Join our WhatsApp/Facebook community group.', 3, 4, false),
            (v_template_id, 'Schedule Kick-off Call', 'Book a call with your coach.', 3, 5, true),
            (v_template_id, 'Download Coaching App', 'Download the app to track your workouts.', 0, 6, true);
    END IF;
END $$;
