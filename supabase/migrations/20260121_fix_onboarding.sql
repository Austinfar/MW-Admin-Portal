
-- Fix for 20260119130000_onboarding_automation_setup.sql
-- Uses 'title' instead of 'name' for onboarding_templates

-- 1. Create activity_logs (if not exists - idempotent)
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    type TEXT NOT NULL, 
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
-- Policies (use DO block to avoid error if policy exists)
DO $$ BEGIN
    CREATE POLICY "Users can view activities" ON public.activity_logs FOR SELECT USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Users can insert activities" ON public.activity_logs FOR INSERT WITH CHECK (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. payment_schedules modification (Safe)
ALTER TABLE public.payment_schedules ADD COLUMN IF NOT EXISTS client_type_id UUID REFERENCES public.client_types(id);


-- 3. Seed Onboarding Template (Corrected)
DO $$
DECLARE
    v_template_id UUID;
BEGIN
    -- Check using TITLE, not NAME
    SELECT id INTO v_template_id FROM public.onboarding_templates WHERE title = 'Standard Onboarding';
    
    -- If not, create it
    IF v_template_id IS NULL THEN
        INSERT INTO public.onboarding_templates (title, description)
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
