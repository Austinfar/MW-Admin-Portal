
import { SidebarProvider } from '@/components/dashboard/SidebarContext'
import { DashboardContent } from '@/components/dashboard/DashboardContent'
import { getCurrentUserAccess } from '@/lib/auth-utils'
import { EasterEggProvider } from '@/components/dashboard/EasterEggProvider'

import { isImpersonating } from '@/lib/actions/impersonation'

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const userAccess = await getCurrentUserAccess() || { role: 'user' as const, permissions: {} }
    const impersonating = await isImpersonating()

    return (
        <EasterEggProvider>
            <SidebarProvider>
                <DashboardContent userAccess={userAccess} isImpersonating={impersonating}>
                    {children}
                </DashboardContent>
            </SidebarProvider>
        </EasterEggProvider>
    )
}
