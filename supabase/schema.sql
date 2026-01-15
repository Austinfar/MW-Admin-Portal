-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- USERS TABLE
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT CHECK (role IN ('admin', 'coach', 'sales_closer')) NOT NULL DEFAULT 'coach',
    ghl_user_id TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- CLIENT TYPES TABLE
CREATE TABLE public.client_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- CLIENTS TABLE
CREATE TABLE public.clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ghl_contact_id TEXT UNIQUE NOT NULL,
    stripe_customer_id TEXT,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    client_type_id UUID REFERENCES public.client_types(id),
    assigned_coach_id UUID REFERENCES public.users(id),
    lead_source TEXT CHECK (lead_source IN ('coach_driven', 'company_driven')),
    start_date DATE NOT NULL,
    contract_end_date DATE GENERATED ALWAYS AS (start_date + INTERVAL '6 months') STORED,
    is_resign BOOLEAN DEFAULT false,
    status TEXT CHECK (status IN ('active', 'inactive', 'lost')) DEFAULT 'active',
    pipeline_stage TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ONBOARDING TEMPLATES TABLE
CREATE TABLE public.onboarding_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_type_id UUID REFERENCES public.client_types(id),
    task_name TEXT NOT NULL,
    task_order INTEGER NOT NULL,
    due_days INTEGER NOT NULL, -- Days after start_date
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ONBOARDING TASKS TABLE
CREATE TABLE public.onboarding_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    template_id UUID REFERENCES public.onboarding_templates(id),
    task_name TEXT NOT NULL,
    due_date DATE NOT NULL,
    status TEXT CHECK (status IN ('pending', 'completed', 'overdue')) DEFAULT 'pending',
    completed_at TIMESTAMP WITH TIME ZONE,
    completed_by_id UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- COMMISSION SETTINGS TABLE
CREATE TABLE public.commission_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    setting_key TEXT UNIQUE NOT NULL,
    setting_value DECIMAL NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_by_id UUID REFERENCES public.users(id)
);

-- COMMISSION SPLITS TABLE
CREATE TABLE public.commission_splits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id),
    role_in_sale TEXT CHECK (role_in_sale IN ('primary_coach', 'referral', 'closer')) NOT NULL,
    split_percentage DECIMAL NOT NULL CHECK (split_percentage >= 0 AND split_percentage <= 100),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by_id UUID REFERENCES public.users(id)
);

-- PAYMENTS TABLE
CREATE TABLE public.payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES public.clients(id),
    stripe_payment_id TEXT UNIQUE NOT NULL,
    amount DECIMAL NOT NULL,
    payment_date TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT CHECK (status IN ('succeeded', 'failed', 'refunded')) NOT NULL,
    product_name TEXT,
    commission_calculated BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- SYNC LOGS TABLE
CREATE TABLE public.sync_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source TEXT CHECK (source IN ('ghl', 'stripe')) NOT NULL,
    event_type TEXT NOT NULL,
    status TEXT CHECK (status IN ('success', 'failure')) NOT NULL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insert Default Client Types
INSERT INTO public.client_types (name) VALUES 
('Competition Prep'),
('Lifestyle'),
('Hyrox'),
('Strength & Conditioning'),
('Marathon Running');

-- RLS POLICIES (Basic Setup)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Admins can view all
CREATE POLICY "Admins can view all users" ON public.users FOR SELECT USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'));
-- Coaches view themselves
CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING (auth.uid() = id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
