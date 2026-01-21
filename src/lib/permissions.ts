/**
 * Shared permission types and utilities that can be used in both client and server components
 */

export type ViewScope = 'none' | 'own' | 'all';

export interface UserPermissions {
    can_view_dashboard?: ViewScope;
    can_view_clients?: ViewScope;
    can_view_leads?: ViewScope;
    can_view_sales?: ViewScope;
    can_view_sales_floor?: ViewScope;
    can_view_onboarding?: ViewScope;
    can_view_business?: ViewScope;
    can_view_commissions?: ViewScope;
    can_manage_payment_links?: ViewScope;
    can_view_team_settings?: ViewScope;
    // Payroll permissions
    can_approve_payroll?: boolean;
    can_create_manual_commissions?: boolean;
    [key: string]: string | boolean | undefined;
}

export interface UserAccess {
    role: 'super_admin' | 'admin' | 'user';
    permissions: UserPermissions;
    first_name?: string;
    last_name?: string;
    job_title?: string;
}

/**
 * Check if user has absolutely no permissions enabled
 */
export function hasNoPermissions(permissions: UserPermissions): boolean {
    const permissionKeys: (keyof UserPermissions)[] = [
        'can_view_dashboard',
        'can_view_clients',
        'can_view_leads',
        'can_view_sales',
        'can_view_sales_floor',
        'can_view_onboarding',
        'can_view_business',
        'can_view_commissions',
        'can_manage_payment_links',
        'can_view_team_settings',
    ];

    // If every permission is either undefined, 'none', or false, user has no access
    return permissionKeys.every(key => {
        const value = permissions[key];
        return value === undefined || value === 'none' || value === false;
    });
}
