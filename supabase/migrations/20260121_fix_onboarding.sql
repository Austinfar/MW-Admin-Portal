
-- Fix for 20260119130000_onboarding_automation_setup.sql
-- Force schema reconstruction for onboarding tables

-- 1. Create activity_logs (if not exists)
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
DO $$ BEGIN CREATE POLICY "Users can view activities" ON public.activity_logs FOR SELECT USING (auth.role() = 'authenticated'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can insert activities" ON public.activity_logs FOR INSERT WITH CHECK (auth.role() = 'authenticated'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Ensure payment_schedules column
ALTER TABLE public.payment_schedules ADD COLUMN IF NOT EXISTS client_type_id UUID REFERENCES public.client_types(id);


-- 3. Reconstruct Onboarding Tables (Drop existing if incompatible)
-- We check if 'title' column exists. If not, we drop and recreate.
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_templates' AND column_name = 'title') THEN
        DROP TABLE IF EXISTS public.onboarding_task_templates CASCADE;
        DROP TABLE IF EXISTS public.onboarding_templates CASCADE;
        
        -- Create onboarding_templates
        CREATE TABLE public.onboarding_templates (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            title TEXT NOT NULL,
            description TEXT,
            created_at TIMESTAMPTZ DEFAULT now() NOT NULL
        );
        ALTER TABLE public.onboarding_templates ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "Admins manage templates" ON public.onboarding_templates FOR ALL USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'));

        -- Create onboarding_task_templates
        CREATE TABLE public.onboarding_task_templates (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            template_id UUID REFERENCES public.onboarding_templates(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            description TEXT,
            due_offset_days INTEGER DEFAULT 0,
            display_order INTEGER DEFAULT 0,
            is_required BOOLEAN DEFAULT true,
            created_at TIMESTAMPTZ DEFAULT now() NOT NULL
        );
        ALTER TABLE public.onboarding_task_templates ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "Admins manage task templates" ON public.onboarding_task_templates FOR ALL USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'));
    END IF;
END $$;


-- 4. Seed Standard Template
DO $$
DECLARE
    v_template_id UUID;
BEGIN
    SELECT id INTO v_template_id FROM public.onboarding_templates WHERE title = 'Standard Onboarding';
    
    IF v_template_id IS NULL THEN
        INSERT INTO public.onboarding_templates (title, description)
        VALUES ('Standard Onboarding', 'Default onboarding tasks for new clients')
        RETURNING id INTO v_template_id;
        
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
