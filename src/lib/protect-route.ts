import { redirect } from 'next/navigation'
import { getCurrentUserAccess, UserPermissions } from '@/lib/auth-utils'

export async function protectRoute(permission: keyof UserPermissions) {
    const userAccess = await getCurrentUserAccess()

    if (!userAccess) {
        return redirect('/login')
    }

    const { role, permissions } = userAccess

    // Super Admin passes everything
    if (role === 'super_admin') return

    const permValue = permissions[permission]

    // Check if permission is denied
    if (permValue === 'none' || permValue === false) {
        console.warn(`[AccessControl] Denied access to restricted route. Permission: ${permission}, Role: ${role}`)
        // Redirect to root, which handles smart redirect to allowed page
        return redirect('/')
    }
}
