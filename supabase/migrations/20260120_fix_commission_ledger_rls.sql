-- Fix Commission Ledger RLS to include super_admin role
-- The original policy only checked for 'admin' role but not 'super_admin'

-- Drop the old policy
DROP POLICY IF EXISTS "Admins view all commissions" ON public.commission_ledger;

-- Create a new policy that includes both admin and super_admin
CREATE POLICY "Admins view all commissions" ON public.commission_ledger
    FOR ALL USING (
        auth.uid() IN (
            SELECT id FROM public.users WHERE role IN ('admin', 'super_admin')
        )
    );
