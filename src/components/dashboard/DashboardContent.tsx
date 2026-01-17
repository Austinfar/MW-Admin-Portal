'use client'

import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { useSidebar } from './SidebarContext'
import { cn } from '@/lib/utils'

export function DashboardContent({ children }: { children: React.ReactNode }) {
    const { isCollapsed } = useSidebar()

    return (
        <div className="h-full relative bg-background">
            <div className={cn(
                "hidden h-full md:flex md:flex-col md:fixed md:inset-y-0 z-[80] transition-all duration-300",
                isCollapsed ? "md:w-[72px]" : "md:w-72"
            )}>
                <Sidebar />
            </div>
            <main className={cn(
                "transition-all duration-300",
                isCollapsed ? "md:pl-[72px]" : "md:pl-72"
            )}>
                <Header />
                <div className="p-8 min-h-[calc(100vh-64px)]">
                    {children}
                </div>
            </main>
        </div>
    )
}
