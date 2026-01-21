
-- Reconstructing missing tables based on codebase usage
-- Date: 2026-01-21

-- ============================================
-- 1. SALES CALL LOGS (Missing from base schema)
-- ============================================
CREATE TABLE IF NOT EXISTS public.sales_call_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    sales_rep_id UUID REFERENCES public.users(id), -- Inferred
    transcript TEXT,
    summary TEXT,
    status TEXT CHECK (status IN ('processing', 'completed', 'failed')) DEFAULT 'processing',
    recording_url TEXT, 
    duration_seconds INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS
ALTER TABLE public.sales_call_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view all logs" ON public.sales_call_logs FOR ALL USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'));

-- ============================================
-- 2. PAYMENT SCHEDULES (Missing)
-- ============================================
CREATE TABLE IF NOT EXISTS public.payment_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES public.clients(id),
    lead_id UUID, -- Assuming leads table exists or created later? (Leads table created in validation 20260119033000, so check order)
    -- If leads table doesn't exist yet, we can add column, but FK might fail if table not there.
    -- Migration 20260119033000 creates leads. So we should create this table carefully.
    -- I will create basic columns and allow migrations to add FKs if needed.
    
    plan_name TEXT,
    amount DECIMAL DEFAULT 0,
    total_amount DECIMAL DEFAULT 0,
    remaining_amount DECIMAL DEFAULT 0,
    currency TEXT DEFAULT 'usd',
    
    status TEXT CHECK (status IN ('draft', 'pending_initial', 'active', 'completed', 'cancelled')) DEFAULT 'draft',
    payment_type TEXT CHECK (payment_type IN ('one_time', 'recurring', 'split')),
    
    stripe_price_id TEXT,
    stripe_session_id TEXT,
    
    start_date DATE,
    assigned_coach_id UUID REFERENCES public.users(id),
    sales_closer_id UUID REFERENCES public.users(id),
    client_type_id UUID REFERENCES public.client_types(id),
    
    commission_splits JSONB DEFAULT '[]'::jsonb,
    schedule_json JSONB DEFAULT '[]'::jsonb,
    program_term TEXT DEFAULT '6',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS
ALTER TABLE public.payment_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage schedules" ON public.payment_schedules FOR ALL USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'));

-- ============================================
-- 3. SCHEDULED CHARGES (For split payments)
-- ============================================
CREATE TABLE IF NOT EXISTS public.scheduled_charges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    schedule_id UUID REFERENCES public.payment_schedules(id) ON DELETE CASCADE,
    amount DECIMAL NOT NULL,
    due_date DATE NOT NULL,
    status TEXT CHECK (status IN ('pending', 'paid', 'failed', 'cancelled')) DEFAULT 'pending',
    stripe_payment_intent_id TEXT,
    stripe_invoice_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS
ALTER TABLE public.scheduled_charges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage charges" ON public.scheduled_charges FOR ALL USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'));


-- Triggers for updated_at
CREATE TRIGGER update_sales_call_logs_updated_at BEFORE UPDATE ON public.sales_call_logs FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_payment_schedules_updated_at BEFORE UPDATE ON public.payment_schedules FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
