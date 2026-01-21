import { getCurrentUserAccess } from "@/lib/auth-utils"
import { protectRoute } from "@/lib/protect-route"
import { getDashboardData } from "@/lib/actions/dashboard-data"
import { WelcomeGreeting } from "@/components/dashboard/WelcomeGreeting"
import { RoleDashboard } from "@/components/dashboard/RoleDashboard"
import { createClient } from "@/lib/supabase/server"

export const dynamic = 'force-dynamic' // Ensure real-time data

export default async function DashboardPage() {
    await protectRoute('can_view_dashboard')

    const [userAccess, supabase] = await Promise.all([
        getCurrentUserAccess(),
        createClient()
    ])

    if (!userAccess) {
        return null // Will be redirected by protectRoute
    }

    const { data: { user } } = await supabase.auth.getUser()
    const userId = user?.id || ''
    const firstName = userAccess.first_name || 'Coach'

    // Fetch dashboard data based on user's role
    const dashboardData = await getDashboardData(
        userId,
        userAccess.role,
        userAccess.job_title || null,
        userAccess.permissions
    )

    return (
        <div className="flex-1 space-y-6">
            {/* Welcome Message */}
            <div className="hidden md:block">
                <WelcomeGreeting name={firstName} />
                <p className="text-muted-foreground text-sm">
                    Here&apos;s what&apos;s happening with your business today.
                </p>
            </div>

            {/* Role-Based Dashboard */}
            <RoleDashboard
                userAccess={userAccess}
                data={dashboardData}
            />
        </div>
    )
}
