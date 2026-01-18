-- Add sold_by_user_id to clients
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS sold_by_user_id UUID REFERENCES public.users(id);

-- Add stripe_fee and net_amount to payments
ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS stripe_fee DECIMAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS net_amount DECIMAL;

-- Add commission_config to users
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS commission_config JSONB DEFAULT '{}'::jsonb;

-- COMMISSION LEDGER TABLE
CREATE TABLE IF NOT EXISTS public.commission_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) NOT NULL,
    client_id UUID REFERENCES public.clients(id) NOT NULL,
    payment_id UUID REFERENCES public.payments(id) UNIQUE NOT NULL,
    gross_amount DECIMAL NOT NULL,
    net_amount DECIMAL NOT NULL, -- Basis
    commission_amount DECIMAL NOT NULL,
    calculation_basis JSONB NOT NULL,
    status TEXT CHECK (status IN ('pending', 'paid', 'void')) DEFAULT 'pending',
    payout_period_start DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS for Commission Ledger
ALTER TABLE public.commission_ledger ENABLE ROW LEVEL SECURITY;

-- Admins view all
CREATE POLICY "Admins view all commissions" ON public.commission_ledger
    FOR ALL USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'));

-- Users view own
CREATE POLICY "Users view own commissions" ON public.commission_ledger
    FOR SELECT USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_commission_ledger_updated_at BEFORE UPDATE ON public.commission_ledger FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
