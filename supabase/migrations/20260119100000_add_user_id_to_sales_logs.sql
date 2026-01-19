-- Add user_id column to sales_call_logs table
ALTER TABLE sales_call_logs 
ADD COLUMN user_id UUID REFERENCES auth.users(id);

-- Optional: Add index for faster queries on user_id
CREATE INDEX idx_sales_call_logs_user_id ON sales_call_logs(user_id);
