-- Add start_date and assigned_coach_id to payment_schedules
ALTER TABLE public.payment_schedules
ADD COLUMN IF NOT EXISTS start_date DATE,
ADD COLUMN IF NOT EXISTS assigned_coach_id UUID REFERENCES public.users(id);

-- Add helper to update these fields (optional, but good for RLS if needed, though we use admin client usually for public updates via action)
