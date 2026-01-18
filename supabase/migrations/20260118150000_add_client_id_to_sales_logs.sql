-- Add client_id column to sales_call_logs referencing clients table
ALTER TABLE sales_call_logs 
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL;

-- Create an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_sales_logs_client_id ON sales_call_logs(client_id);
