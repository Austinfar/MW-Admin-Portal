
import { Sidebar } from '@/components/dashboard/Sidebar'
import { Header } from '@/components/dashboard/Header'
import { SidebarProvider } from '@/components/dashboard/SidebarContext'
import { DashboardContent } from '@/components/dashboard/DashboardContent'

import { getCurrentUserAccess } from '@/lib/auth-utils'

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    // Default to a restricted 'coach' view with no extra permissions if fetch fails
    const userAccess = await getCurrentUserAccess() || { role: 'coach', permissions: {} }

    return (
        <SidebarProvider>
            <DashboardContent userAccess={userAccess}>
                {children}
            </DashboardContent>
        </SidebarProvider>
    )
}
