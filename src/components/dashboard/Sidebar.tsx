'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { LayoutDashboard, Users, CheckSquare, DollarSign, Settings, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'

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
        label: 'Settings',
        icon: Settings,
        href: '/settings',
    },
]

export function Sidebar({ className }: { className?: string }) {
    const pathname = usePathname()

    return (
        <div className={cn("space-y-4 py-4 flex flex-col h-full bg-sidebar text-sidebar-foreground border-r border-sidebar-border", className)}>
            <div className="px-3 py-2 flex-1">
                <Link href="/" className="flex items-center pl-3 mb-14">
                    <div className="relative w-8 h-8 mr-4">
                        {/* Logo placeholder - replace with actual logo */}
                        <div className="absolute inset-0 bg-primary/20 rounded-lg blur-md animate-pulse" />
                        <div className="relative w-full h-full bg-sidebar-accent rounded-lg border border-sidebar-border flex items-center justify-center font-bold text-lg text-primary">
                            MW
                        </div>
                    </div>
                    <h1 className="text-xl font-bold text-sidebar-foreground">
                        MW Fitness Coaching
                    </h1>
                </Link>
                <div className="space-y-1">
                    {routes.map((route) => (
                        <Link
                            key={route.href}
                            href={route.href}
                            className={cn(
                                "text-sm group flex p-3 w-full justify-start font-medium cursor-pointer rounded-lg transition duration-200",
                                pathname === route.href
                                    ? "bg-primary text-primary-foreground shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                                    : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                            )}
                        >
                            <div className="flex items-center flex-1">
                                <route.icon className={cn("h-5 w-5 mr-3", pathname === route.href ? "text-primary-foreground" : route.color)} />
                                {route.label}
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
            <div className="px-3">
                <form action="/auth/signout" method="post">
                    <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50">
                        <LogOut className="h-5 w-5 mr-3" />
                        Logout
                    </Button>
                </form>
            </div>
        </div>
    )
}
