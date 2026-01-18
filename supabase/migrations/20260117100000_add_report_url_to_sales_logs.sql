-- Add report_url column to sales_call_logs table
ALTER TABLE public.sales_call_logs
ADD COLUMN report_url TEXT;

COMMENT ON COLUMN public.sales_call_logs.report_url IS 'URL to the HTML report stored in Supabase Storage';
