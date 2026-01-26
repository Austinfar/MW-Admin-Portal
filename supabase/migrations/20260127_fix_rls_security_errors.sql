-- Migration: Fix Security Errors (Enable RLS)
-- Date: 2026-01-27
-- Description: Enables RLS on public tables identified by security linter.

-- ==============================================================================
-- 1. commission_settings
-- ==============================================================================
ALTER TABLE public.commission_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage commission settings"
ON public.commission_settings
FOR ALL
USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);

CREATE POLICY "Authenticated users view commission settings"
ON public.commission_settings
FOR SELECT
TO authenticated
USING (true);

-- ==============================================================================
-- 2. onboarding_templates
-- ==============================================================================
ALTER TABLE public.onboarding_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage onboarding templates"
ON public.onboarding_templates
FOR ALL
USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);

CREATE POLICY "Authenticated users view onboarding templates"
ON public.onboarding_templates
FOR SELECT
TO authenticated
USING (true);

-- ==============================================================================
-- 3. sync_logs
-- ==============================================================================
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage sync logs"
ON public.sync_logs
FOR ALL
USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);

-- ==============================================================================
-- 4. onboarding_task_templates
-- ==============================================================================
ALTER TABLE public.onboarding_task_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage onboarding task templates"
ON public.onboarding_task_templates
FOR ALL
USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);

CREATE POLICY "Authenticated users view onboarding task templates"
ON public.onboarding_task_templates
FOR SELECT
TO authenticated
USING (true);

-- ==============================================================================
-- 5. client_types
-- ==============================================================================
ALTER TABLE public.client_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage client types"
ON public.client_types
FOR ALL
USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);

CREATE POLICY "Authenticated users view client types"
ON public.client_types
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Public view active client types"
ON public.client_types
FOR SELECT
TO anon
USING (is_active = true);

-- ==============================================================================
-- 6. onboarding_tasks
-- ==============================================================================
ALTER TABLE public.onboarding_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage onboarding tasks"
ON public.onboarding_tasks
FOR ALL
USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);

CREATE POLICY "Authenticated users manage assigned onboarding tasks"
ON public.onboarding_tasks
FOR ALL
TO authenticated
USING (
   -- Users can access if they are assigned to the task (staff)
   assigned_user_id = auth.uid()
   OR
   -- OR if they are the coach of the client associated with the task
   EXISTS (
       SELECT 1 FROM public.clients 
       WHERE clients.id = onboarding_tasks.client_id 
       AND clients.assigned_coach_id = auth.uid()
   )
);

-- ==============================================================================
-- 7. subscriptions
-- ==============================================================================
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage subscriptions"
ON public.subscriptions
FOR ALL
USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);

CREATE POLICY "Authenticated users view subscriptions"
ON public.subscriptions
FOR SELECT
TO authenticated
USING (
   -- Users can view if they are the coach
   EXISTS (
       SELECT 1 FROM public.clients 
       WHERE clients.id = subscriptions.client_id 
       AND clients.assigned_coach_id = auth.uid()
   )
);
