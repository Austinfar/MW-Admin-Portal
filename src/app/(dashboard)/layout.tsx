
import { SidebarProvider } from '@/components/dashboard/SidebarContext'
import { DashboardContent } from '@/components/dashboard/DashboardContent'
import { getCurrentUserAccess } from '@/lib/auth-utils'
import { EasterEggProvider } from '@/components/dashboard/EasterEggProvider'

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const userAccess = await getCurrentUserAccess() || { role: 'coach', permissions: {} }

    return (
        <EasterEggProvider>
            <SidebarProvider>
                <DashboardContent userAccess={userAccess}>
                    {children}
                </DashboardContent>
            </SidebarProvider>
        </EasterEggProvider>
    )
}
