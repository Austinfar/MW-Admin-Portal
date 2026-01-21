-- Fix missing columns in payroll_runs table
-- Run this in Supabase SQL Editor

-- Add all columns that might be missing
ALTER TABLE public.payroll_runs
    ADD COLUMN IF NOT EXISTS total_commission DECIMAL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_adjustments DECIMAL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_payout DECIMAL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS transaction_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS void_reason TEXT,
    ADD COLUMN IF NOT EXISTS voided_by UUID REFERENCES public.users(id),
    ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.users(id),
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS paid_by UUID REFERENCES public.users(id),
    ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- Verify the status check constraint allows all needed statuses
ALTER TABLE public.payroll_runs DROP CONSTRAINT IF EXISTS payroll_runs_status_check;
ALTER TABLE public.payroll_runs
    ADD CONSTRAINT payroll_runs_status_check
    CHECK (status IN ('draft', 'approved', 'paid', 'void'));
