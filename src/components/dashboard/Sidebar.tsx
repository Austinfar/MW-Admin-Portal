'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { LayoutDashboard, Users, CheckSquare, DollarSign, LogOut, ChevronLeft, ChevronRight, CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSidebar } from './SidebarContext'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const routes = [
    {
        label: 'Dashboard',
        icon: LayoutDashboard,
        href: '/',
        color: 'text-sky-500',
    },
    {
        label: 'Clients',
        icon: Users,
        href: '/clients',
        color: 'text-violet-500',
    },
    {
        label: 'Onboarding',
        icon: CheckSquare,
        href: '/onboarding',
        color: 'text-pink-700',
    },
    {
        label: 'Business',
        icon: DollarSign,
        href: '/business',
        color: 'text-emerald-500',
    },
    {
        label: 'Commissions',
        icon: DollarSign,
        href: '/commissions',
        color: 'text-orange-700',
    },
    {
        label: 'Payment Links',
        icon: CreditCard,
        href: '/payment-links',
        color: 'text-blue-500',
    },
]

export function Sidebar({ className, isMobile = false }: { className?: string; isMobile?: boolean }) {
    const pathname = usePathname()
    const { isCollapsed, toggleSidebar } = useSidebar()

    // Don't collapse on mobile sheet
    const collapsed = isMobile ? false : isCollapsed

    return (
        <TooltipProvider delayDuration={0}>
            <div className={cn(
                "space-y-4 py-4 flex flex-col h-full bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300",
                collapsed ? "w-[72px]" : "w-72",
                className
            )}>
                <div className={cn("py-2 flex-1", collapsed ? "px-2" : "px-3")}>
                    <Link href="/" className={cn(
                        "flex items-center mb-14 transition-all duration-300",
                        collapsed ? "justify-center px-0" : "pl-3"
                    )}>
                        <div className={cn("relative w-8 h-8", collapsed ? "mr-0" : "mr-4")}>
                            {/* Logo placeholder - replace with actual logo */}
                            <div className="absolute inset-0 bg-primary/20 rounded-lg blur-md animate-pulse" />
                            <div className="relative w-full h-full bg-sidebar-accent rounded-lg border border-sidebar-border flex items-center justify-center font-bold text-lg text-primary">
                                MW
                            </div>
                        </div>
                        {!collapsed && (
                            <h1 className="text-xl font-bold text-sidebar-foreground whitespace-nowrap">
                                MW Fitness Coaching
                            </h1>
                        )}
                    </Link>
                    <div className="space-y-1">
                        {routes.map((route) => {
                            const linkContent = (
                                <Link
                                    key={route.href}
                                    href={route.href}
                                    className={cn(
                                        "text-sm group flex p-3 w-full font-medium cursor-pointer rounded-lg transition duration-200",
                                        collapsed ? "justify-center" : "justify-start",
                                        pathname === route.href
                                            ? "bg-primary text-primary-foreground shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                                            : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                                    )}
                                >
                                    <div className={cn("flex items-center", collapsed ? "justify-center" : "flex-1")}>
                                        <route.icon className={cn(
                                            "h-5 w-5",
                                            collapsed ? "mr-0" : "mr-3",
                                            pathname === route.href ? "text-primary-foreground" : route.color
                                        )} />
                                        {!collapsed && route.label}
                                    </div>
                                </Link>
                            )

                            if (collapsed) {
                                return (
                                    <Tooltip key={route.href}>
                                        <TooltipTrigger asChild>
                                            {linkContent}
                                        </TooltipTrigger>
                                        <TooltipContent side="right" className="bg-popover border-border">
                                            {route.label}
                                        </TooltipContent>
                                    </Tooltip>
                                )
                            }

                            return linkContent
                        })}
                    </div>
                </div>

                {/* Collapse Toggle Button - only show on desktop */}
                {!isMobile && (
                    <div className={cn("px-3", collapsed && "px-2")}>
                        <Button
                            variant="ghost"
                            onClick={toggleSidebar}
                            className={cn(
                                "w-full text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50",
                                collapsed ? "justify-center px-0" : "justify-start"
                            )}
                        >
                            {collapsed ? (
                                <ChevronRight className="h-5 w-5" />
                            ) : (
                                <>
                                    <ChevronLeft className="h-5 w-5 mr-3" />
                                    Collapse
                                </>
                            )}
                        </Button>
                    </div>
                )}

                <div className={cn("px-3", collapsed && "px-2")}>
                    <form action="/auth/signout" method="post">
                        {collapsed ? (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" className="w-full justify-center text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50 px-0">
                                        <LogOut className="h-5 w-5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="right" className="bg-popover border-border">
                                    Logout
                                </TooltipContent>
                            </Tooltip>
                        ) : (
                            <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50">
                                <LogOut className="h-5 w-5 mr-3" />
                                Logout
                            </Button>
                        )}
                    </form>
                </div>
            </div>
        </TooltipProvider>
    )
}
