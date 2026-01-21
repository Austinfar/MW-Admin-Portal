
'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { LayoutDashboard, Users, CheckSquare, DollarSign, LogOut, ChevronLeft, ChevronRight, CreditCard, BrainCircuit, Calendar, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSidebar } from './SidebarContext'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { UserAccess } from '@/lib/auth-utils'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible"

import { APP_ROUTES, checkRouteAccess } from '@/lib/routes'

export function Sidebar({ className, isMobile = false, userAccess }: { className?: string; isMobile?: boolean; userAccess?: UserAccess }) {
    const pathname = usePathname()
    const { isCollapsed, toggleSidebar } = useSidebar()
    const { role, permissions } = userAccess || { role: 'coach', permissions: {} }

    // Don't collapse on mobile sheet
    const collapsed = isMobile ? false : isCollapsed

    // Filter routes based on permissions
    const filteredRoutes = APP_ROUTES.filter(route => {
        return checkRouteAccess(route, role, permissions)
    })

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
                        <div className={cn("relative", collapsed ? "w-8 h-8 mr-0" : "w-40 h-12 mr-4")}>
                            {collapsed ? (
                                <Image
                                    src="/icon-green.svg"
                                    alt="MW"
                                    width={32}
                                    height={32}
                                    className="object-contain"
                                />
                            ) : (
                                <Image
                                    src="/logo-white.svg"
                                    alt="MW Fitness Coaching"
                                    width={160}
                                    height={48}
                                    className="object-contain"
                                    priority
                                />
                            )}
                        </div>
                    </Link>
                    <div className="space-y-1">
                        {filteredRoutes.map((route) => {
                            // Helper to determine if a route (or its children) is active
                            const isActive = route.href === pathname || route.children?.some(child => child.href === pathname)
                            const isParent = route.children && route.children.length > 0

                            if (isParent) {
                                // Nested Menu Item
                                if (collapsed) {
                                    // Collapsed State: Dropdown/Popover
                                    return (
                                        <DropdownMenu key={route.label}>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    className={cn(
                                                        "w-full p-2 h-auto justify-center",
                                                        isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-sidebar-accent/50"
                                                    )}
                                                >
                                                    <route.icon className={cn("h-5 w-5", route.color)} />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent side="right" className="w-56 bg-popover border-border p-2" align="start">
                                                <div className="px-2 py-1.5 text-sm font-semibold text-foreground">
                                                    {route.label}
                                                </div>
                                                <div className="h-px bg-border my-1" />
                                                {route.children?.map(child => (
                                                    child.href && checkRouteAccess(child, role, permissions) && (
                                                        <Link key={child.href} href={child.href}>
                                                            <DropdownMenuItem className={cn("cursor-pointer focus:bg-sidebar-accent", pathname === child.href && "bg-sidebar-accent")}>
                                                                <child.icon className={cn("mr-2 h-4 w-4", child.color)} />
                                                                <span>{child.label}</span>
                                                            </DropdownMenuItem>
                                                        </Link>
                                                    )
                                                ))}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    )
                                }

                                // Expanded State: Collapsible
                                return (
                                    <Collapsible key={route.label} defaultOpen={isActive} className="group/collapsible">
                                        <CollapsibleTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                className={cn(
                                                    "w-full justify-between hover:bg-sidebar-accent/50 text-muted-foreground hover:text-sidebar-foreground",
                                                    isActive && "text-sidebar-foreground"
                                                )}
                                            >
                                                <div className="flex items-center">
                                                    <route.icon className={cn("mr-3 h-5 w-5", route.color)} />
                                                    {route.label}
                                                </div>
                                                <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                                            </Button>
                                        </CollapsibleTrigger>
                                        <CollapsibleContent className="pl-4 space-y-1 pt-1">
                                            {route.children?.map(child => (
                                                child.href && checkRouteAccess(child, role, permissions) && (
                                                    <Link
                                                        key={child.href}
                                                        href={child.href}
                                                        className={cn(
                                                            "text-sm group flex p-2 w-full font-medium cursor-pointer rounded-lg transition duration-200 justify-start",
                                                            pathname === child.href
                                                                ? "bg-primary/10 text-primary" // Different active style for nested
                                                                : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                                                        )}
                                                    >
                                                        <div className="flex items-center flex-1">
                                                            <child.icon className={cn(
                                                                "h-4 w-4 mr-3", // Smaller icon for nested
                                                                child.color
                                                            )} />
                                                            {child.label}
                                                        </div>
                                                    </Link>
                                                )
                                            ))}
                                        </CollapsibleContent>
                                    </Collapsible>
                                )
                            }

                            // Single Menu Item
                            const linkContent = (
                                <Link
                                    key={route.href}
                                    href={route.href!}
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
