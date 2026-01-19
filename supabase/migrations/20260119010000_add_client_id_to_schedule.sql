-- Add client_id to payment_schedules
ALTER TABLE public.payment_schedules
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id);
