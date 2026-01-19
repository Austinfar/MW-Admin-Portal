-- Migration: Update role column to use new permission role values
-- This updates existing roles to the new system:
-- super_admin: Full access (highest privilege)
-- admin: Elevated access (bypasses permission checks)
-- user: Standard access (uses permission toggles)

-- First, update any existing role values to new values
UPDATE users SET role = 'user' WHERE role IN ('coach', 'sales_closer');

-- Note: 'admin' stays as 'admin', no change needed

-- The role column should already be TEXT, but ensure it can accept any of the new values
-- ALTER the CHECK constraint if one exists (skip if not present)
-- Since PostgreSQL doesn't support ALTER CONSTRAINT directly, we just ensure the column accepts the new values
COMMENT ON COLUMN users.role IS 'Permission role: super_admin (full access), admin (elevated access), user (permission-based)';
