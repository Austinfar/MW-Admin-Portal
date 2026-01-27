-- Add cal_username and event_slug to cal_user_links table for V2 API compatibility
ALTER TABLE cal_user_links ADD COLUMN IF NOT EXISTS cal_username text;
ALTER TABLE cal_user_links ADD COLUMN IF NOT EXISTS event_slug text;
