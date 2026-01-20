import { LayoutDashboard, Users, CheckSquare, DollarSign, CreditCard, BrainCircuit, Calendar, Lightbulb } from 'lucide-react'
import { UserPermissions } from '@/lib/auth-utils'

export interface AppRoute {
    label: string
    icon?: any // using generic type to avoid strict icon typing issues in config
    href: string
    color?: string
    permission?: keyof UserPermissions
}

// Ordered list of routes - used for Sidebar AND for "Smart Redirect" priority
export const APP_ROUTES: AppRoute[] = [
    {
        label: 'Dashboard',
        icon: LayoutDashboard,
        href: '/dashboard',
        color: 'text-sky-500',
        permission: 'can_view_dashboard'
    },
    {
        label: 'Sales Floor',
        icon: Calendar,
        href: '/sales-floor',
        color: 'text-yellow-500',
        permission: 'can_view_sales_floor'
    },
    {
        label: 'Leads',
        icon: Users,
        href: '/leads',
        color: 'text-cyan-500',
        // Note: In sidebar this was can_view_leads. Confirming consistency.
        permission: 'can_view_leads'
    },
    {
        label: 'Clients',
        icon: Users,
        href: '/clients',
        color: 'text-violet-500',
        permission: 'can_view_clients'
    },
    {
        label: 'Onboarding',
        icon: CheckSquare,
        href: '/onboarding',
        color: 'text-pink-700',
        permission: 'can_view_onboarding'
    },
    {
        label: 'Business',
        icon: DollarSign,
        href: '/business',
        color: 'text-emerald-500',
        permission: 'can_view_business'
    },
    {
        label: 'Commissions',
        icon: DollarSign,
        href: '/commissions',
        color: 'text-orange-700',
        permission: 'can_view_commissions'
    },
    {
        label: 'Payment Links',
        icon: CreditCard,
        href: '/payment-links',
        color: 'text-blue-500',
        permission: 'can_manage_payment_links'
    },
    {
        label: 'AI Sales Call Analyzer',
        icon: BrainCircuit,
        href: '/sales',
        color: 'text-rose-500',
        permission: 'can_view_sales'
    },
    {
        label: 'Roadmap',
        icon: Lightbulb,
        href: '/roadmap',
        color: 'text-neon-green',
        // No permission required - accessible to all authenticated users
    },
]

export const checkRouteAccess = (route: AppRoute, role: string | undefined, permissions: UserPermissions): boolean => {
    // Super Admin always sees everything
    if (role === 'super_admin') return true

    // If no specific permission is required, it's open (or managed elsewhere)
    if (!route.permission) return true

    const permValue = permissions[route.permission]

    if (permValue === true) return true
    if (permValue === 'all' || permValue === 'own') return true

    return false
}

/**
 * Get the first permitted route for a user based on their role and permissions.
 * Returns the href of the first route they have access to.
 * Defaults to '/roadmap' since it has no permission requirement.
 */
export const getFirstPermittedRoute = (role: string | undefined, permissions: UserPermissions): string => {
    // Super Admin always goes to dashboard
    if (role === 'super_admin') return '/dashboard'

    // Find the first route the user has access to
    for (const route of APP_ROUTES) {
        if (checkRouteAccess(route, role, permissions)) {
            return route.href
        }
    }

    // Fallback to roadmap (which has no permission requirement) or login if something is wrong
    return '/roadmap'
}
