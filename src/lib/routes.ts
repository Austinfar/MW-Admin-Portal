import { LayoutDashboard, Users, CheckSquare, DollarSign, CreditCard, BrainCircuit, Calendar, Lightbulb, Camera, Quote, Drill, CalendarClock } from 'lucide-react'
import { UserPermissions } from '@/lib/auth-utils'

export interface AppRoute {
    label: string
    icon?: any // using generic type to avoid strict icon typing issues in config
    href?: string // Optional for parent items
    color?: string
    permission?: keyof UserPermissions
    children?: AppRoute[]
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
        label: 'Sales',
        icon: DollarSign,
        color: 'text-green-600',
        // No permission on parent, visible if children are visible
        children: [
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
                permission: 'can_view_leads'
            },
            {
                label: 'Payment Links',
                icon: CreditCard,
                href: '/payment-links',
                color: 'text-blue-500',
                permission: 'can_manage_payment_links'
            },
            {
                label: 'Commissions',
                icon: DollarSign,
                href: '/commissions',
                color: 'text-orange-700',
                permission: 'can_view_commissions'
            },

        ]
    },
    {
        label: 'Coaching',
        icon: Users, // Using Users as generic coaching icon
        color: 'text-violet-500',
        // No permission on parent
        children: [
            {
                label: 'Onboarding',
                icon: CheckSquare,
                href: '/onboarding',
                color: 'text-pink-700',
                permission: 'can_view_onboarding'
            },
            {
                label: 'Clients',
                icon: Users,
                href: '/clients',
                color: 'text-violet-500',
                permission: 'can_view_clients'
            },
            {
                label: 'Renewals',
                icon: CalendarClock,
                href: '/renewals',
                color: 'text-amber-500',
                permission: 'can_view_business'
            },
        ]
    },
    {
        label: 'Admin',
        icon: LayoutDashboard, // Generic admin icon
        color: 'text-emerald-500',
        permission: 'can_view_business',
        children: [
            {
                label: 'Admin Board',
                icon: DollarSign,
                href: '/business',
                color: 'text-emerald-500',
                permission: 'can_view_business'
            },
            {
                label: 'Payment Schedules',
                icon: CreditCard,
                href: '/admin/payment-schedules',
                color: 'text-blue-500',
                permission: 'can_view_business'
            },
            {
                label: 'Transformations',
                icon: Camera,
                href: '/transformations',
                color: 'text-purple-500',
                permission: 'can_view_business'
            },
            {
                label: 'Testimonials',
                icon: Quote,
                href: '/testimonials',
                color: 'text-pink-500',
                permission: 'can_view_business'
            },
        ]
    },
    {
        label: '(Power) Tools',
        icon: Drill, // Power tool icon
        color: 'text-indigo-500',
        permission: 'can_view_leads',
        children: [
            {
                label: 'Link Generator',
                icon: Lightbulb,
                href: '/tools/links',
                color: 'text-indigo-400',
                permission: 'can_view_leads'
            },
            {
                label: 'AI Call Analyzer',
                icon: BrainCircuit,
                href: '/sales',
                color: 'text-rose-500',
                permission: 'can_view_sales'
            }
        ]
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

    // If it has children, it's visible if AT LEAST ONE child is visible
    if (route.children && route.children.length > 0) {
        return route.children.some(child => checkRouteAccess(child, role, permissions))
    }

    // Normal permission check for leaf nodes
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
    // Super Admin: Dashboard
    if (role === 'super_admin') return '/dashboard'

    // Recursive helper to find first accessible href
    const findFirst = (routes: AppRoute[]): string | null => {
        for (const route of routes) {
            if (checkRouteAccess(route, role, permissions)) {
                // If it's a leaf node with href, return it
                if (route.href) return route.href

                // If it has children, look inside
                if (route.children) {
                    const childHref = findFirst(route.children)
                    if (childHref) return childHref
                }
            }
        }
        return null
    }

    const first = findFirst(APP_ROUTES)
    if (first) return first

    // Fallback to roadmap
    return '/roadmap'
}
