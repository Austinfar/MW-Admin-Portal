-- Add interval_count to subscriptions table
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS interval_count INTEGER DEFAULT 1;

-- Add comment
COMMENT ON COLUMN subscriptions.interval_count IS 'Number of intervals between subscription billings (e.g. 6 for 6 months)';
