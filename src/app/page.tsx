
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { APP_ROUTES, checkRouteAccess } from '@/lib/routes'
import { getCurrentUserAccess } from '@/lib/auth-utils'

export default async function IndexPage() {
    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        return redirect('/login')
    }

    const userAccess = await getCurrentUserAccess()

    // If no access (shouldn't happen here due to !user check above, but safe guard)
    if (!userAccess) {
        return redirect('/login')
    }

    const { role, permissions } = userAccess

    // Find the first route the user has access to
    const allowedRoute = APP_ROUTES.find(route => checkRouteAccess(route, role, permissions))

    if (allowedRoute) {
        return redirect(allowedRoute.href)
    }

    // Fallback to roadmap (always accessible) if no routes match
    return redirect('/roadmap')
}
