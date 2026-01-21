-- Fix ALL Commission System RLS Policies for super_admin access
-- Run this in Supabase SQL Editor to ensure super_admins have full access

-- ============================================
-- 1. COMMISSION LEDGER
-- ============================================
DROP POLICY IF EXISTS "Admins view all commissions" ON public.commission_ledger;
DROP POLICY IF EXISTS "Users view own commissions" ON public.commission_ledger;

CREATE POLICY "Admins view all commissions" ON public.commission_ledger
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
    );

CREATE POLICY "Users view own commissions" ON public.commission_ledger
    FOR SELECT USING (auth.uid() = user_id);

-- ============================================
-- 2. PAYROLL RUNS
-- ============================================
DROP POLICY IF EXISTS "Admins manage payroll runs" ON public.payroll_runs;
DROP POLICY IF EXISTS "Users view relevant payroll runs" ON public.payroll_runs;

CREATE POLICY "Admins manage payroll runs" ON public.payroll_runs
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
    );

CREATE POLICY "Users view relevant payroll runs" ON public.payroll_runs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM commission_ledger
            WHERE commission_ledger.payroll_run_id = payroll_runs.id
            AND commission_ledger.user_id = auth.uid()
        )
    );

-- ============================================
-- 3. COMMISSION ADJUSTMENTS
-- ============================================
DROP POLICY IF EXISTS "Admins manage adjustments" ON public.commission_adjustments;
DROP POLICY IF EXISTS "Users view own adjustments" ON public.commission_adjustments;

CREATE POLICY "Admins manage adjustments" ON public.commission_adjustments
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
    );

CREATE POLICY "Users view own adjustments" ON public.commission_adjustments
    FOR SELECT USING (
        user_id = auth.uid() AND is_visible_to_user = true
    );

-- ============================================
-- 4. SUBSCRIPTION COMMISSION CONFIG
-- ============================================
DROP POLICY IF EXISTS "Admins manage subscription config" ON public.subscription_commission_config;

CREATE POLICY "Admins manage subscription config" ON public.subscription_commission_config
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
    );

-- ============================================
-- VERIFY: Check that RLS is enabled on all tables
-- ============================================
ALTER TABLE public.commission_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_commission_config ENABLE ROW LEVEL SECURITY;
