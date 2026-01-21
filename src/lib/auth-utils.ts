
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Re-export shared types for backwards compatibility
export type { ViewScope, UserPermissions, UserAccess } from './permissions';
export { hasNoPermissions } from './permissions';

import type { UserAccess, UserPermissions } from './permissions';

export async function getCurrentUserAccess(): Promise<UserAccess | null> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return null;

    const admin = createAdminClient();

    const { data, error } = await admin
        .from('users')
        .select('role, permissions, first_name, last_name, job_title')
        .eq('id', user.id)
        .single();

    if (error || !data) return null;

    const role = (data.role || 'user') as UserAccess['role'];
    const first_name = data.first_name || '';
    const last_name = data.last_name || '';
    const job_title = data.job_title || '';
    let permissions = (data.permissions || {}) as UserPermissions;

    // Normalize legacy boolean permissions to ViewScope
    Object.keys(permissions).forEach(key => {
        const k = key as keyof UserPermissions;
        // @ts-ignore - Runtime check for boolean legacy data
        if (permissions[k] === true) permissions[k] = 'all';
        // @ts-ignore - Runtime check for boolean legacy data
        if (permissions[k] === false) permissions[k] = 'none';
    });

    // SUPER ADMIN: Always ALL
    if (role === 'super_admin') {
        permissions = {
            can_view_dashboard: 'all',
            can_view_clients: 'all',
            can_view_leads: 'all',
            can_view_sales: 'all',
            can_view_sales_floor: 'all',
            can_view_onboarding: 'all',
            can_view_business: 'all',
            can_view_commissions: 'all',
            can_manage_payment_links: 'all',
            can_view_team_settings: 'all',
            // Payroll permissions - super_admin has all
            can_approve_payroll: true,
            can_create_manual_commissions: true,
            ...permissions
        };
    }

    // ADMIN: Default to ALL if not specified, but configurable
    else if (role === 'admin') {
        permissions = {
            can_view_dashboard: permissions.can_view_dashboard ?? 'all',
            can_view_clients: permissions.can_view_clients ?? 'all',
            can_view_leads: permissions.can_view_leads ?? 'all',
            can_view_sales: permissions.can_view_sales ?? 'all',
            can_view_sales_floor: permissions.can_view_sales_floor ?? 'all',
            can_view_onboarding: permissions.can_view_onboarding ?? 'all',
            can_view_business: permissions.can_view_business ?? 'all',
            can_view_commissions: permissions.can_view_commissions ?? 'all',
            can_manage_payment_links: permissions.can_manage_payment_links ?? 'all',
            can_view_team_settings: permissions.can_view_team_settings ?? 'all',
            // Payroll permissions - admins need explicit grant, default false
            can_approve_payroll: permissions.can_approve_payroll ?? false,
            can_create_manual_commissions: permissions.can_create_manual_commissions ?? false,
        };
    }
    // USERS (Coaches/Sales): Default to explicit permissions or restrict
    else {
        // Safe defaults for standard users
        // If a permission is missing, it defaults to 'none' logically below, 
        // but here we just pass what's in the DB.
    }

    return { role, permissions, first_name, last_name, job_title };
}

// Keep deprecated function for backward compat if needed, but we should replace usages
export async function getCurrentUserRole() {
    const access = await getCurrentUserAccess();
    return access?.role;
}

