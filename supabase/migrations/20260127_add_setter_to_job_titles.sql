-- Add 'setter' to the valid_job_title check constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS valid_job_title;

ALTER TABLE users 
ADD CONSTRAINT valid_job_title 
CHECK (job_title IN ('coach', 'head_coach', 'closer', 'admin_staff', 'operations', 'setter'));
