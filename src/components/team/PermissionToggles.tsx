
'use client'

import { useState } from 'react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { updateUserPermissions } from '@/lib/actions/profile'
import { toast } from 'sonner'
import { UserPermissions } from '@/lib/auth-utils'

interface PermissionTogglesProps {
    userId: string
    initialPermissions: UserPermissions
    onUpdate?: () => void
}

const PERMISSION_LABELS: Record<keyof UserPermissions, string> = {
    can_view_dashboard: 'View Dashboard',
    can_view_clients: 'View Clients Tab',
    can_view_leads: 'View Leads Tab',
    can_view_sales: 'View Sales Analyzer',
    can_view_sales_floor: 'View Sales Floor',
    can_view_onboarding: 'View Onboarding',
    can_view_business: 'View Business/Commisions',
    can_view_payment_links: 'View Payment Links',
    can_manage_team: 'Manage Team & Permissions'
}

export function PermissionToggles({ userId, initialPermissions, onUpdate }: PermissionTogglesProps) {
    const [permissions, setPermissions] = useState<UserPermissions>(initialPermissions)
    const [isUpdating, setIsUpdating] = useState(false)

    const handleToggle = async (key: keyof UserPermissions) => {
        const newValue = !permissions[key]
        const newPermissions = { ...permissions, [key]: newValue }

        setPermissions(newPermissions)
        setIsUpdating(true)

        try {
            const result = await updateUserPermissions(userId, newPermissions)
            if (result.error) throw new Error(result.error)
            toast.success('Permissions updated')
            if (onUpdate) onUpdate()
        } catch (error) {
            console.error(error)
            toast.error('Failed to update permissions')
            // Revert state
            setPermissions(permissions)
        } finally {
            setIsUpdating(false)
        }
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
                <div key={key} className="flex items-center space-x-2 border p-3 rounded-lg hover:bg-muted/50 transition-colors">
                    <Switch
                        id={`${userId}-${key}`}
                        checked={!!permissions[key]}
                        onCheckedChange={() => handleToggle(key)}
                        disabled={isUpdating}
                    />
                    <Label htmlFor={`${userId}-${key}`} className="cursor-pointer flex-1">
                        {label}
                    </Label>
                </div>
            ))}
        </div>
    )
}
