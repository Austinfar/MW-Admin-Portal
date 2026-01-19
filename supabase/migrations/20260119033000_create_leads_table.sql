-- Create leads table
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name TEXT NOT NULL,
    last_name TEXT,
    email TEXT,
    phone TEXT,
    description TEXT,
    status TEXT DEFAULT 'New' CHECK (status IN ('New', 'Contacted', 'Appt Set', 'Closed Won', 'Closed Lost')),
    source TEXT,
    assigned_user_id UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Simple policies for now (similar to clients usually)
CREATE POLICY "Enable read access for authenticated users" 
ON public.leads FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable insert access for authenticated users" 
ON public.leads FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Enable update access for authenticated users" 
ON public.leads FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Enable delete access for authenticated users" 
ON public.leads FOR DELETE TO authenticated USING (true);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_leads_updated_at ON public.leads;
CREATE TRIGGER update_leads_updated_at 
BEFORE UPDATE ON public.leads 
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
