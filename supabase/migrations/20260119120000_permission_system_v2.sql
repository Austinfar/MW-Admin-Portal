-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    target_resource TEXT NOT NULL,
    target_id TEXT NOT NULL,
    action TEXT NOT NULL,
    changes JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on audit_logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Only super_admin can view audit logs (policy will be refined later, for now strictly secured)
CREATE POLICY "Super admins can view audit logs" ON audit_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid() AND users.role = 'super_admin'
        )
    );

-- Add deleted_at to critical tables for Soft Deletes
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;


-- Data Migration: Convert functional roles to job_titles
-- 1. Update job_title for 'coach' role if empty
UPDATE users 
SET job_title = 'Coach', role = 'user'
WHERE role = 'coach';

-- 2. Update job_title for 'sales' role if empty
UPDATE users 
SET job_title = 'Sales', role = 'user'
WHERE role = 'sales';

-- 3. Ensure super_admin and admin roles remain touched, but job_title is sensible if null
UPDATE users
SET job_title = 'Administrator'
WHERE role = 'admin' AND (job_title IS NULL OR job_title = '');

-- 4. Update any existing users permissions to be compatible with new structure? 
-- (We will handle permission structure migration in application code lazy-init or separate script if JSON structure changes significantly)
