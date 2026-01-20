import { NextResponse } from 'next/server'
import { getCurrentUserAccess } from '@/lib/auth-utils'
import { getFirstPermittedRoute } from '@/lib/routes'

/**
 * API endpoint to get the first permitted route for the current user.
 * Used by the auth callback to redirect users to their appropriate landing page.
 */
export async function GET() {
    try {
        const userAccess = await getCurrentUserAccess()

        if (!userAccess) {
            // If no user, redirect to login
            return NextResponse.json({ redirect: '/login' })
        }

        const redirectPath = getFirstPermittedRoute(userAccess.role, userAccess.permissions)

        return NextResponse.json({ redirect: redirectPath })
    } catch (error) {
        console.error('Smart redirect error:', error)
        // Fallback to roadmap on error
        return NextResponse.json({ redirect: '/roadmap' })
    }
}
