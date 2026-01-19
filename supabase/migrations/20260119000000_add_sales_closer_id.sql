-- Add sales_closer_id to payment_schedules
ALTER TABLE public.payment_schedules
ADD COLUMN IF NOT EXISTS sales_closer_id UUID REFERENCES public.users(id);
