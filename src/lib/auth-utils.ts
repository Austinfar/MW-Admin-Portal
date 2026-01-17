
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export interface UserPermissions {
    can_view_dashboard?: boolean;
    can_view_clients?: boolean;
    can_view_sales?: boolean;
    can_view_onboarding?: boolean;
    can_view_business?: boolean;
    can_view_payment_links?: boolean;
    can_manage_team?: boolean;
    [key: string]: boolean | undefined;
}

export interface UserAccess {
    role: string;
    permissions: UserPermissions;
    first_name?: string;
    last_name?: string;
}

export async function getCurrentUserAccess(): Promise<UserAccess | null> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return null;

    const admin = createAdminClient();

    const { data, error } = await admin
        .from('users')
        .select('role, permissions, first_name, last_name')
        .eq('id', user.id)
        .single();

    if (error || !data) return null;

    const role = data.role || 'coach';
    const first_name = data.first_name || '';
    const last_name = data.last_name || '';
    let permissions = (data.permissions || {}) as UserPermissions;

    // If admin, grant all permissions implicitly
    if (role === 'admin') {
        permissions = {
            can_view_dashboard: true,
            can_view_clients: true,
            can_view_sales: true,
            can_view_onboarding: true,
            can_view_business: true,
            can_view_payment_links: true,
            can_manage_team: true,
            ...permissions
        };
    }

    return { role, permissions, first_name, last_name };
}

// Keep deprecated function for backward compat if needed, but we should replace usages
export async function getCurrentUserRole() {
    const access = await getCurrentUserAccess();
    return access?.role;
}
