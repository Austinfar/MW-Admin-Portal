import { UserPermissions } from '@/lib/auth-utils'
import {
    TrendingUp,
    CreditCard,
    Users,
    DollarSign,
    AlertCircle,
    Activity,
    Target,
    Phone,
    CheckSquare,
    BarChart3,
    Calendar,
    UserPlus,
    Settings,
    Briefcase,
    type LucideIcon
} from 'lucide-react'

// Widget identifiers
export type WidgetId =
    // Metric Cards (top row)
    | 'forecast'
    | 'mrr'
    | 'active_clients'
    | 'pending_commissions'
    | 'my_revenue'
    | 'deals_closed'
    | 'close_rate'
    | 'my_commission'
    | 'bookings'
    | 'shows'
    | 'show_rate'
    | 'my_clients'
    | 'in_onboarding'
    | 'onboarding_tasks'
    | 'failed_payments'
    | 'open_issues'
    // Main widgets
    | 'revenue_chart'
    | 'sales_funnel'
    | 'commission_summary'
    | 'quota_progress'
    | 'next_call'
    | 'follow_up_tasks'
    | 'leads_to_work'
    | 'upcoming_calls'
    | 'client_stats'
    | 'onboarding_overview'
    | 'client_activity'
    | 'onboarding_board'
    // Sidebar widgets
    | 'alerts'
    | 'recent_activity'
    | 'quick_actions'
    | 'closer_leaderboard'
    | 'setter_leaderboard'
    | 'my_tasks'

// Widget metadata for rendering
export interface WidgetMeta {
    id: WidgetId
    title: string
    icon: LucideIcon
    iconColor: string
    // Grid span for responsive layouts (1-4 for top row, 1-2 for main area)
    gridSpan?: 1 | 2 | 3 | 4
    // Required permission to view this widget
    permission?: keyof UserPermissions
}

// Widget metadata registry
export const WIDGET_META: Record<WidgetId, WidgetMeta> = {
    // Metric Cards
    forecast: {
        id: 'forecast',
        title: '2026 Forecast',
        icon: TrendingUp,
        iconColor: 'text-primary',
        permission: 'can_view_business'
    },
    mrr: {
        id: 'mrr',
        title: 'MRR',
        icon: CreditCard,
        iconColor: 'text-emerald-500',
        permission: 'can_view_business'
    },
    active_clients: {
        id: 'active_clients',
        title: 'Active Clients',
        icon: Users,
        iconColor: 'text-blue-500',
        permission: 'can_view_clients'
    },
    pending_commissions: {
        id: 'pending_commissions',
        title: 'Pending Commissions',
        icon: DollarSign,
        iconColor: 'text-orange-500',
        permission: 'can_view_commissions'
    },
    my_revenue: {
        id: 'my_revenue',
        title: 'My Revenue',
        icon: DollarSign,
        iconColor: 'text-green-500'
    },
    deals_closed: {
        id: 'deals_closed',
        title: 'Deals Closed',
        icon: Target,
        iconColor: 'text-blue-500'
    },
    close_rate: {
        id: 'close_rate',
        title: 'Close Rate',
        icon: BarChart3,
        iconColor: 'text-purple-500'
    },
    my_commission: {
        id: 'my_commission',
        title: 'My Commission',
        icon: DollarSign,
        iconColor: 'text-orange-500',
        permission: 'can_view_commissions'
    },
    bookings: {
        id: 'bookings',
        title: 'Bookings',
        icon: Calendar,
        iconColor: 'text-cyan-500'
    },
    shows: {
        id: 'shows',
        title: 'Shows',
        icon: Users,
        iconColor: 'text-green-500'
    },
    show_rate: {
        id: 'show_rate',
        title: 'Show Rate',
        icon: BarChart3,
        iconColor: 'text-purple-500'
    },
    my_clients: {
        id: 'my_clients',
        title: 'My Clients',
        icon: Users,
        iconColor: 'text-violet-500',
        permission: 'can_view_clients'
    },
    in_onboarding: {
        id: 'in_onboarding',
        title: 'In Onboarding',
        icon: Activity,
        iconColor: 'text-orange-500',
        permission: 'can_view_onboarding'
    },
    onboarding_tasks: {
        id: 'onboarding_tasks',
        title: 'Onboarding Tasks',
        icon: CheckSquare,
        iconColor: 'text-pink-500',
        permission: 'can_view_onboarding'
    },
    failed_payments: {
        id: 'failed_payments',
        title: 'Failed Payments',
        icon: AlertCircle,
        iconColor: 'text-red-500',
        permission: 'can_view_business'
    },
    open_issues: {
        id: 'open_issues',
        title: 'Open Issues',
        icon: AlertCircle,
        iconColor: 'text-amber-500'
    },

    // Main Area Widgets
    revenue_chart: {
        id: 'revenue_chart',
        title: 'Revenue Overview',
        icon: BarChart3,
        iconColor: 'text-emerald-500',
        gridSpan: 2,
        permission: 'can_view_business'
    },
    sales_funnel: {
        id: 'sales_funnel',
        title: 'Sales Funnel',
        icon: Target,
        iconColor: 'text-blue-500',
        gridSpan: 1,
        permission: 'can_view_sales_floor'
    },
    commission_summary: {
        id: 'commission_summary',
        title: 'Commission Summary',
        icon: DollarSign,
        iconColor: 'text-orange-500',
        gridSpan: 1,
        permission: 'can_view_commissions'
    },
    quota_progress: {
        id: 'quota_progress',
        title: 'Quota Progress',
        icon: Target,
        iconColor: 'text-primary',
        gridSpan: 2
    },
    next_call: {
        id: 'next_call',
        title: 'Next Call',
        icon: Phone,
        iconColor: 'text-green-500',
        gridSpan: 1
    },
    follow_up_tasks: {
        id: 'follow_up_tasks',
        title: 'Follow-up Tasks',
        icon: CheckSquare,
        iconColor: 'text-amber-500',
        gridSpan: 1
    },
    leads_to_work: {
        id: 'leads_to_work',
        title: 'Leads to Work',
        icon: Users,
        iconColor: 'text-cyan-500',
        gridSpan: 1,
        permission: 'can_view_leads'
    },
    upcoming_calls: {
        id: 'upcoming_calls',
        title: 'Upcoming Calls',
        icon: Calendar,
        iconColor: 'text-blue-500',
        gridSpan: 1
    },
    client_stats: {
        id: 'client_stats',
        title: 'Client Stats',
        icon: Users,
        iconColor: 'text-violet-500',
        gridSpan: 2,
        permission: 'can_view_clients'
    },
    onboarding_overview: {
        id: 'onboarding_overview',
        title: 'Onboarding Overview',
        icon: CheckSquare,
        iconColor: 'text-pink-500',
        gridSpan: 1,
        permission: 'can_view_onboarding'
    },
    client_activity: {
        id: 'client_activity',
        title: 'Recent Client Activity',
        icon: Activity,
        iconColor: 'text-blue-500',
        gridSpan: 1,
        permission: 'can_view_clients'
    },
    onboarding_board: {
        id: 'onboarding_board',
        title: 'Onboarding Board',
        icon: CheckSquare,
        iconColor: 'text-pink-500',
        gridSpan: 2,
        permission: 'can_view_onboarding'
    },

    // Sidebar Widgets
    alerts: {
        id: 'alerts',
        title: 'Alerts',
        icon: AlertCircle,
        iconColor: 'text-red-500',
        permission: 'can_view_business'
    },
    recent_activity: {
        id: 'recent_activity',
        title: 'Recent Activity',
        icon: Activity,
        iconColor: 'text-blue-500'
    },
    quick_actions: {
        id: 'quick_actions',
        title: 'Quick Actions',
        icon: Briefcase,
        iconColor: 'text-primary'
    },
    closer_leaderboard: {
        id: 'closer_leaderboard',
        title: 'Top Closers',
        icon: BarChart3,
        iconColor: 'text-green-500',
        permission: 'can_view_sales_floor'
    },
    setter_leaderboard: {
        id: 'setter_leaderboard',
        title: 'Top Setters',
        icon: BarChart3,
        iconColor: 'text-cyan-500',
        permission: 'can_view_sales_floor'
    },
    my_tasks: {
        id: 'my_tasks',
        title: 'My Tasks',
        icon: CheckSquare,
        iconColor: 'text-amber-500'
    }
}

// Dashboard layout structure
export interface DashboardLayout {
    topRow: WidgetId[]      // 4 metric cards
    mainArea: WidgetId[]    // Primary widgets (left 2/3)
    sidebar: WidgetId[]     // Right column (1/3)
}

// Quick action configuration
export interface QuickAction {
    label: string
    href: string
    icon: LucideIcon
    iconColor: string
    permission?: keyof UserPermissions
}

// Role-based dashboard configurations
export const DASHBOARD_LAYOUTS: Record<string, DashboardLayout> = {
    // Super Admin & Admin - Business Overview
    super_admin: {
        topRow: ['forecast', 'mrr', 'active_clients', 'pending_commissions'],
        mainArea: ['revenue_chart', 'sales_funnel', 'commission_summary'],
        sidebar: ['alerts', 'recent_activity', 'quick_actions']
    },
    admin: {
        topRow: ['forecast', 'mrr', 'active_clients', 'pending_commissions'],
        mainArea: ['revenue_chart', 'sales_funnel', 'commission_summary'],
        sidebar: ['alerts', 'recent_activity', 'quick_actions']
    },

    // Closer - Sales Focus
    closer: {
        topRow: ['my_revenue', 'deals_closed', 'close_rate', 'my_commission'],
        mainArea: ['quota_progress', 'next_call', 'follow_up_tasks'],
        sidebar: ['closer_leaderboard', 'quick_actions']
    },

    // Setter - Appointment Focus
    setter: {
        topRow: ['bookings', 'shows', 'show_rate', 'my_commission'],
        mainArea: ['quota_progress', 'leads_to_work', 'upcoming_calls'],
        sidebar: ['setter_leaderboard', 'quick_actions']
    },

    // Coach - Client Focus
    coach: {
        topRow: ['my_clients', 'in_onboarding', 'active_clients', 'my_commission'],
        mainArea: ['client_stats', 'onboarding_overview', 'client_activity'],
        sidebar: ['quick_actions', 'my_tasks']
    },

    // Head Coach - Team + Client Focus
    head_coach: {
        topRow: ['active_clients', 'in_onboarding', 'pending_commissions', 'my_commission'],
        mainArea: ['client_stats', 'onboarding_overview', 'commission_summary'],
        sidebar: ['recent_activity', 'quick_actions']
    },

    // Operations - Process Focus
    operations: {
        topRow: ['active_clients', 'onboarding_tasks', 'failed_payments', 'open_issues'],
        mainArea: ['onboarding_board', 'client_stats'],
        sidebar: ['recent_activity', 'alerts']
    },

    // Admin Staff - Support Focus
    admin_staff: {
        topRow: ['active_clients', 'onboarding_tasks', 'failed_payments', 'open_issues'],
        mainArea: ['onboarding_board', 'client_stats'],
        sidebar: ['recent_activity', 'alerts']
    }
}

// Role-based quick actions
export const QUICK_ACTIONS: Record<string, QuickAction[]> = {
    super_admin: [
        { label: 'View Business', href: '/business', icon: BarChart3, iconColor: 'text-emerald-500', permission: 'can_view_business' },
        { label: 'Team Settings', href: '/settings/team', icon: Settings, iconColor: 'text-blue-500', permission: 'can_view_team_settings' },
        { label: 'Commissions', href: '/commissions', icon: DollarSign, iconColor: 'text-orange-500', permission: 'can_view_commissions' }
    ],
    admin: [
        { label: 'View Business', href: '/business', icon: BarChart3, iconColor: 'text-emerald-500', permission: 'can_view_business' },
        { label: 'Team Settings', href: '/settings/team', icon: Settings, iconColor: 'text-blue-500', permission: 'can_view_team_settings' },
        { label: 'View Leads', href: '/leads', icon: Users, iconColor: 'text-cyan-500', permission: 'can_view_leads' }
    ],
    closer: [
        { label: 'New Lead', href: '/leads', icon: UserPlus, iconColor: 'text-green-500', permission: 'can_view_leads' },
        { label: 'Payment Link', href: '/payment-links', icon: CreditCard, iconColor: 'text-blue-500', permission: 'can_manage_payment_links' },
        { label: 'Sales Floor', href: '/sales-floor', icon: Target, iconColor: 'text-yellow-500', permission: 'can_view_sales_floor' }
    ],
    setter: [
        { label: 'New Lead', href: '/leads', icon: UserPlus, iconColor: 'text-green-500', permission: 'can_view_leads' },
        { label: 'View Leads', href: '/leads', icon: Users, iconColor: 'text-cyan-500', permission: 'can_view_leads' },
        { label: 'Sales Floor', href: '/sales-floor', icon: Target, iconColor: 'text-yellow-500', permission: 'can_view_sales_floor' }
    ],
    coach: [
        { label: 'View Clients', href: '/clients', icon: Users, iconColor: 'text-violet-500', permission: 'can_view_clients' },
        { label: 'Onboarding', href: '/onboarding', icon: CheckSquare, iconColor: 'text-pink-500', permission: 'can_view_onboarding' },
        { label: 'Commissions', href: '/commissions', icon: DollarSign, iconColor: 'text-orange-500', permission: 'can_view_commissions' }
    ],
    head_coach: [
        { label: 'View Clients', href: '/clients', icon: Users, iconColor: 'text-violet-500', permission: 'can_view_clients' },
        { label: 'Onboarding', href: '/onboarding', icon: CheckSquare, iconColor: 'text-pink-500', permission: 'can_view_onboarding' },
        { label: 'Commissions', href: '/commissions', icon: DollarSign, iconColor: 'text-orange-500', permission: 'can_view_commissions' }
    ],
    operations: [
        { label: 'Onboarding', href: '/onboarding', icon: CheckSquare, iconColor: 'text-pink-500', permission: 'can_view_onboarding' },
        { label: 'View Clients', href: '/clients', icon: Users, iconColor: 'text-violet-500', permission: 'can_view_clients' },
        { label: 'Settings', href: '/settings', icon: Settings, iconColor: 'text-blue-500' }
    ],
    admin_staff: [
        { label: 'Onboarding', href: '/onboarding', icon: CheckSquare, iconColor: 'text-pink-500', permission: 'can_view_onboarding' },
        { label: 'View Clients', href: '/clients', icon: Users, iconColor: 'text-violet-500', permission: 'can_view_clients' },
        { label: 'Settings', href: '/settings', icon: Settings, iconColor: 'text-blue-500' }
    ]
}

/**
 * Get the dashboard layout for a user based on their role and job title
 */
export function getDashboardLayout(
    role: 'super_admin' | 'admin' | 'user',
    jobTitle?: string | null
): DashboardLayout {
    // Super admin and admin get business overview
    if (role === 'super_admin') return DASHBOARD_LAYOUTS.super_admin
    if (role === 'admin') return DASHBOARD_LAYOUTS.admin

    // For regular users, use job title to determine layout
    if (jobTitle && DASHBOARD_LAYOUTS[jobTitle]) {
        return DASHBOARD_LAYOUTS[jobTitle]
    }

    // Default to coach layout for unspecified job titles
    return DASHBOARD_LAYOUTS.coach
}

/**
 * Get quick actions for a user based on their role and job title
 */
export function getQuickActions(
    role: 'super_admin' | 'admin' | 'user',
    jobTitle?: string | null
): QuickAction[] {
    if (role === 'super_admin') return QUICK_ACTIONS.super_admin
    if (role === 'admin') return QUICK_ACTIONS.admin

    if (jobTitle && QUICK_ACTIONS[jobTitle]) {
        return QUICK_ACTIONS[jobTitle]
    }

    return QUICK_ACTIONS.coach
}

/**
 * Check if a widget should be visible based on user permissions
 */
export function canViewWidget(
    widgetId: WidgetId,
    role: 'super_admin' | 'admin' | 'user',
    permissions: UserPermissions
): boolean {
    // Super admin sees everything
    if (role === 'super_admin') return true

    const meta = WIDGET_META[widgetId]
    if (!meta.permission) return true

    const permValue = permissions[meta.permission]
    if (permValue === true) return true
    if (permValue === 'all' || permValue === 'own') return true

    // Admin defaults to having permissions unless explicitly denied
    if (role === 'admin' && permValue !== 'none' && permValue !== false) {
        return true
    }

    return false
}
