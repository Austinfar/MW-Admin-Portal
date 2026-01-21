'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { LogOut, ChevronRight, ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSidebar } from './SidebarContext'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { UserAccess, UserPermissions } from '@/lib/auth-utils'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect, useCallback } from 'react'

import { APP_ROUTES, checkRouteAccess } from '@/lib/routes'

// Animation variants
const sidebarVariants = {
    expanded: { width: 288 },
    collapsed: { width: 72 }
}

const childVariants = {
    open: { opacity: 1, x: 0, height: 'auto' },
    closed: { opacity: 0, x: -10, height: 0 }
}

const containerVariants = {
    open: {
        transition: { staggerChildren: 0.05, delayChildren: 0.05 }
    },
    closed: {
        transition: { staggerChildren: 0.03, staggerDirection: -1 }
    }
}

const chevronVariants = {
    open: { rotate: 90 },
    closed: { rotate: 0 }
}

const toggleButtonVariants = {
    expanded: { x: 0, rotate: 0 },
    collapsed: { x: 0, rotate: 180 }
}

// Collapse Toggle Button Component
function CollapseToggle({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <motion.button
                    onClick={onToggle}
                    className={cn(
                        "absolute -right-3 top-7 z-50",
                        "w-6 h-6 rounded-full",
                        "bg-sidebar border border-white/10",
                        "flex items-center justify-center",
                        "text-muted-foreground hover:text-sidebar-foreground",
                        "hover:bg-primary/20 hover:border-primary/30",
                        "hover:shadow-[0_0_15px_var(--glow-primary)]",
                        "transition-all duration-200",
                        "shadow-lg"
                    )}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                    <motion.div
                        initial={false}
                        animate={collapsed ? "collapsed" : "expanded"}
                        variants={toggleButtonVariants}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    >
                        <ChevronLeft className="h-3.5 w-3.5" />
                    </motion.div>
                </motion.button>
            </TooltipTrigger>
            <TooltipContent
                side="right"
                className="bg-[var(--glass-bg)] backdrop-blur-xl border-[var(--glass-border)]"
            >
                <span className="flex items-center gap-2">
                    {collapsed ? 'Expand' : 'Collapse'}
                    <kbd className="px-1.5 py-0.5 text-[10px] bg-white/10 rounded">⌘B</kbd>
                </span>
            </TooltipContent>
        </Tooltip>
    )
}

// NavItem component for single routes
function NavItem({
    route,
    isActive,
    collapsed,
}: {
    route: typeof APP_ROUTES[number]
    isActive: boolean
    collapsed: boolean
}) {
    const linkContent = (
        <Link
            href={route.href!}
            className={cn(
                "group relative flex items-center gap-3 px-3 py-2.5 rounded-xl",
                "transition-all duration-200",
                collapsed ? "justify-center" : "justify-start",
                isActive
                    ? "bg-primary/15 backdrop-blur-md border border-primary/20 shadow-[0_0_20px_var(--glow-primary),inset_0_1px_0_var(--glass-border)]"
                    : "text-muted-foreground hover:text-sidebar-foreground hover:bg-white/5 hover:backdrop-blur-sm"
            )}
        >
            <motion.div
                whileHover={{ scale: 1.1 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
                className="flex items-center justify-center"
            >
                <route.icon className={cn(
                    "h-5 w-5 transition-all duration-200",
                    isActive
                        ? "text-primary drop-shadow-[0_0_8px_var(--glow-primary-strong)]"
                        : route.color
                )} />
            </motion.div>
            <AnimatePresence mode="wait">
                {!collapsed && (
                    <motion.span
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.15 }}
                        className={cn(
                            "text-sm font-medium whitespace-nowrap",
                            isActive ? "text-primary" : ""
                        )}
                    >
                        {route.label}
                    </motion.span>
                )}
            </AnimatePresence>
        </Link>
    )

    if (collapsed) {
        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    {linkContent}
                </TooltipTrigger>
                <TooltipContent
                    side="right"
                    className="bg-[var(--glass-bg)] backdrop-blur-xl border-[var(--glass-border)] shadow-lg"
                >
                    {route.label}
                </TooltipContent>
            </Tooltip>
        )
    }

    return linkContent
}

// NavGroup component for nested routes
function NavGroup({
    route,
    isActive,
    collapsed,
    pathname,
    role,
    permissions
}: {
    route: typeof APP_ROUTES[number]
    isActive: boolean
    collapsed: boolean
    pathname: string
    role: string
    permissions: UserPermissions
}) {
    const [isOpen, setIsOpen] = useState(isActive)

    // Close the menu when sidebar collapses
    useEffect(() => {
        if (collapsed) {
            setIsOpen(false)
        } else if (isActive) {
            setIsOpen(true)
        }
    }, [collapsed, isActive])

    if (collapsed) {
        // Collapsed: Show dropdown on hover/click
        return (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        className={cn(
                            "w-full p-2.5 h-auto justify-center rounded-xl",
                            "transition-all duration-200",
                            isActive
                                ? "bg-primary/10 text-primary backdrop-blur-sm"
                                : "text-muted-foreground hover:bg-white/5 hover:text-sidebar-foreground"
                        )}
                    >
                        <motion.div
                            whileHover={{ scale: 1.1 }}
                            transition={{ type: "spring", stiffness: 400, damping: 17 }}
                        >
                            <route.icon className={cn(
                                "h-5 w-5",
                                isActive ? "text-primary drop-shadow-[0_0_8px_var(--glow-primary-strong)]" : route.color
                            )} />
                        </motion.div>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    side="right"
                    className="w-56 bg-[var(--glass-bg)] backdrop-blur-xl border-[var(--glass-border)] p-2 shadow-xl"
                    align="start"
                    sideOffset={8}
                >
                    <div className="px-2 py-1.5 text-sm font-semibold text-foreground">
                        {route.label}
                    </div>
                    <div className="h-px bg-white/10 my-1" />
                    {route.children?.map(child => (
                        child.href && checkRouteAccess(child, role, permissions) && (
                            <Link key={child.href} href={child.href}>
                                <DropdownMenuItem className={cn(
                                    "cursor-pointer rounded-lg transition-all duration-200",
                                    "focus:bg-white/10 focus:backdrop-blur-sm",
                                    pathname === child.href && "bg-primary/15 text-primary"
                                )}>
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

    // Expanded: Show collapsible section
    return (
        <div className="space-y-1">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "w-full flex items-center justify-between px-3 py-2.5 rounded-xl",
                    "transition-all duration-200",
                    "text-muted-foreground hover:text-sidebar-foreground hover:bg-white/5",
                    isActive && "text-sidebar-foreground"
                )}
            >
                <div className="flex items-center gap-3">
                    <motion.div
                        whileHover={{ scale: 1.1 }}
                        transition={{ type: "spring", stiffness: 400, damping: 17 }}
                    >
                        <route.icon className={cn("h-5 w-5", route.color)} />
                    </motion.div>
                    <span className="text-sm font-medium">{route.label}</span>
                </div>
                <motion.div
                    initial={false}
                    animate={isOpen ? "open" : "closed"}
                    variants={chevronVariants}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                    <ChevronRight className="h-4 w-4" />
                </motion.div>
            </button>

            <AnimatePresence initial={false}>
                {isOpen && (
                    <motion.div
                        initial="closed"
                        animate="open"
                        exit="closed"
                        variants={containerVariants}
                        className="relative pl-4 space-y-1 overflow-hidden"
                    >
                        {/* Connector line */}
                        <motion.div
                            className="absolute left-6 top-0 bottom-2 w-px bg-gradient-to-b from-primary/40 via-primary/20 to-transparent"
                            initial={{ scaleY: 0, originY: 0 }}
                            animate={{ scaleY: 1 }}
                            exit={{ scaleY: 0 }}
                            transition={{ duration: 0.2 }}
                        />

                        {route.children?.map((child) => (
                            child.href && checkRouteAccess(child, role, permissions) && (
                                <motion.div
                                    key={child.href}
                                    variants={childVariants}
                                    transition={{
                                        type: "spring",
                                        stiffness: 300,
                                        damping: 24,
                                        opacity: { duration: 0.2 }
                                    }}
                                >
                                    <Link
                                        href={child.href}
                                        className={cn(
                                            "group relative flex items-center gap-3 pl-6 pr-3 py-2 rounded-xl text-sm",
                                            "transition-all duration-200",
                                            pathname === child.href
                                                ? "bg-primary/15 text-primary backdrop-blur-sm border border-primary/10"
                                                : "text-muted-foreground hover:text-sidebar-foreground hover:bg-white/5"
                                        )}
                                    >
                                        <motion.div
                                            whileHover={{ scale: 1.15 }}
                                            transition={{ type: "spring", stiffness: 400, damping: 17 }}
                                        >
                                            <child.icon className={cn(
                                                "h-4 w-4",
                                                pathname === child.href
                                                    ? "text-primary drop-shadow-[0_0_6px_var(--glow-primary)]"
                                                    : child.color
                                            )} />
                                        </motion.div>
                                        <span className="font-medium">{child.label}</span>
                                    </Link>
                                </motion.div>
                            )
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

export function Sidebar({ className, isMobile = false, userAccess }: { className?: string; isMobile?: boolean; userAccess?: UserAccess }) {
    const pathname = usePathname()
    const { isCollapsed, toggleSidebar, setCollapsed } = useSidebar()
    const { role, permissions } = userAccess || { role: 'coach', permissions: {} }

    // Don't collapse on mobile sheet
    const collapsed = isMobile ? false : isCollapsed

    // Keyboard shortcut handler (Cmd/Ctrl + B)
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
            e.preventDefault()
            toggleSidebar()
        }
    }, [toggleSidebar])

    // Register keyboard shortcut
    useEffect(() => {
        if (!isMobile) {
            window.addEventListener('keydown', handleKeyDown)
            return () => window.removeEventListener('keydown', handleKeyDown)
        }
    }, [handleKeyDown, isMobile])

    // Auto-collapse on smaller screens (between md and lg)
    useEffect(() => {
        if (isMobile) return

        const handleResize = () => {
            const width = window.innerWidth
            // Auto-collapse between 768px (md) and 1024px (lg)
            if (width >= 768 && width < 1024 && !isCollapsed) {
                setCollapsed(true)
            }
        }

        // Check on mount
        handleResize()

        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [isMobile, setCollapsed, isCollapsed])

    // Filter routes based on permissions
    const filteredRoutes = APP_ROUTES.filter(route => {
        return checkRouteAccess(route, role, permissions)
    })

    return (
        <TooltipProvider delayDuration={0}>
            <motion.div
                initial={false}
                animate={collapsed ? "collapsed" : "expanded"}
                variants={sidebarVariants}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className={cn(
                    "relative flex flex-col h-full py-4",
                    "bg-sidebar/80 backdrop-blur-xl",
                    "border-r border-white/5",
                    "shadow-[inset_0_0_30px_rgba(0,0,0,0.3)]",
                    className
                )}
            >
                {/* Collapse Toggle Button - only show on desktop */}
                {!isMobile && (
                    <CollapseToggle collapsed={collapsed} onToggle={toggleSidebar} />
                )}

                <div className={cn("flex-1 overflow-y-auto overflow-x-hidden", collapsed ? "px-2" : "px-3")}>
                    {/* Logo */}
                    <Link href="/" className={cn(
                        "flex items-center mb-8 transition-all duration-300",
                        collapsed ? "justify-center px-0" : "pl-3"
                    )}>
                        <motion.div
                            className={cn("relative", collapsed ? "w-8 h-8" : "w-40 h-12")}
                            layout
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        >
                            <AnimatePresence mode="wait">
                                {collapsed ? (
                                    <motion.div
                                        key="icon"
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.8 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        <Image
                                            src="/icon-green.svg"
                                            alt="MW"
                                            width={32}
                                            height={32}
                                            className="object-contain drop-shadow-[0_0_10px_var(--glow-primary)]"
                                        />
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="logo"
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -10 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        <Image
                                            src="/logo-white.svg"
                                            alt="MW Fitness Coaching"
                                            width={160}
                                            height={48}
                                            className="object-contain"
                                            priority
                                        />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    </Link>

                    {/* Navigation */}
                    <nav className="space-y-1">
                        {filteredRoutes.map((route) => {
                            const isActive = route.href === pathname || route.children?.some(child => child.href === pathname)
                            const isParent = route.children && route.children.length > 0

                            if (isParent) {
                                return (
                                    <NavGroup
                                        key={route.label}
                                        route={route}
                                        isActive={isActive ?? false}
                                        collapsed={collapsed}
                                        pathname={pathname}
                                        role={role}
                                        permissions={permissions as UserPermissions}
                                    />
                                )
                            }

                            return (
                                <NavItem
                                    key={route.href}
                                    route={route}
                                    isActive={pathname === route.href}
                                    collapsed={collapsed}
                                />
                            )
                        })}
                    </nav>
                </div>

                {/* Logout */}
                <div className={cn("px-3 pt-4 border-t border-white/5", collapsed && "px-2")}>
                    <form action="/auth/signout" method="post">
                        {collapsed ? (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        className={cn(
                                            "w-full justify-center rounded-xl p-2.5",
                                            "text-muted-foreground hover:text-sidebar-foreground",
                                            "hover:bg-white/5 transition-all duration-200"
                                        )}
                                    >
                                        <motion.div
                                            whileHover={{ scale: 1.1 }}
                                            transition={{ type: "spring", stiffness: 400, damping: 17 }}
                                        >
                                            <LogOut className="h-5 w-5" />
                                        </motion.div>
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent
                                    side="right"
                                    className="bg-[var(--glass-bg)] backdrop-blur-xl border-[var(--glass-border)]"
                                >
                                    Logout
                                </TooltipContent>
                            </Tooltip>
                        ) : (
                            <Button
                                variant="ghost"
                                className={cn(
                                    "w-full justify-start gap-3 rounded-xl px-3 py-2.5",
                                    "text-muted-foreground hover:text-sidebar-foreground",
                                    "hover:bg-white/5 transition-all duration-200"
                                )}
                            >
                                <motion.div
                                    whileHover={{ scale: 1.1 }}
                                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                                >
                                    <LogOut className="h-5 w-5" />
                                </motion.div>
                                <span className="text-sm font-medium">Logout</span>
                            </Button>
                        )}
                    </form>
                </div>
            </motion.div>
        </TooltipProvider>
    )
}
