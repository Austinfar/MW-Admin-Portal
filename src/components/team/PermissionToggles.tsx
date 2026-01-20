'use client'

import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { updateUserPermissions } from '@/lib/actions/profile'
import { toast } from 'sonner'
import { UserPermissions, ViewScope, UserAccess } from '@/lib/auth-utils'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Loader2, Save } from 'lucide-react'

interface PermissionTogglesProps {
    userId: string
    role: UserAccess['role']
    initialPermissions: UserPermissions
    onUpdate?: () => void
}

const PERMISSION_CONFIG: Record<keyof UserPermissions, { label: string, options: ViewScope[] }> = {
    can_view_dashboard: { label: 'View Dashboard', options: ['none', 'all'] },
    can_view_clients: { label: 'View Clients Tab', options: ['none', 'own', 'all'] },
    can_view_leads: { label: 'View Leads Tab', options: ['none', 'own', 'all'] },
    can_view_sales: { label: 'View Sales Analyzer', options: ['none', 'all'] },
    can_view_sales_floor: { label: 'View Sales Floor', options: ['none', 'all'] },
    can_view_onboarding: { label: 'View Onboarding', options: ['none', 'own', 'all'] },
    can_view_business: { label: 'View Business (P&L)', options: ['none', 'all'] },
    can_view_commissions: { label: 'View Commissions', options: ['none', 'own', 'all'] },
    can_manage_payment_links: { label: 'Manage Payment Links', options: ['none', 'all'] },
    can_view_team_settings: { label: 'View Team Settings', options: ['none', 'all'] }
}

export function PermissionToggles({ userId, role, initialPermissions, onUpdate }: PermissionTogglesProps) {
    // Initialize permissions with defaults based on role to match backend logic
    const [permissions, setPermissions] = useState<UserPermissions>(() => {
        const defaults: UserPermissions = {}
        const isDefaultAll = role === 'admin' || role === 'super_admin'

        Object.keys(PERMISSION_CONFIG).forEach(key => {
            const k = key as keyof UserPermissions
            // If explicit permission exists, use it. Otherwise use role default.
            defaults[k] = initialPermissions[k] || (isDefaultAll ? 'all' : 'none')
        })

        return defaults
    })
    const [isSaving, setIsSaving] = useState(false)
    const [hasChanges, setHasChanges] = useState(false)

    const handleLocalChange = (key: keyof UserPermissions, value: ViewScope) => {
        setPermissions(prev => ({ ...prev, [key]: value }))
        setHasChanges(true)
    }

    const handleSave = async () => {
        setIsSaving(true)
        try {
            const result = await updateUserPermissions(userId, permissions)
            if (result.error) throw new Error(result.error)

            toast.success('Permissions saved successfully')
            setHasChanges(false)
            if (onUpdate) onUpdate()
        } catch (error) {
            console.error(error)
            toast.error('Failed to save permissions')
        } finally {
            setIsSaving(false)
        }
    }

    const getOptionLabel = (option: ViewScope) => {
        switch (option) {
            case 'none': return 'None';
            case 'own': return 'Own';
            case 'all': return 'All';
            default: return option;
        }
    }

    return (
        <div className="space-y-6">
            <div className="space-y-3">
                {Object.entries(PERMISSION_CONFIG).map(([key, config]) => {
                    const permKey = key as keyof UserPermissions;
                    const currentValue = (permissions[permKey] as ViewScope) || 'none';

                    return (
                        <div
                            key={key}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                        >
                            <Label htmlFor={`${userId}-${key}`} className="font-medium text-sm text-gray-300">
                                {config.label}
                            </Label>

                            <div className="flex bg-black/20 p-1 rounded-lg border border-white/5 min-w-[200px] sm:min-w-[240px]">
                                {config.options.map(option => (
                                    <button
                                        key={option}
                                        type="button"
                                        onClick={() => handleLocalChange(permKey, option)}
                                        disabled={isSaving}
                                        className={cn(
                                            "flex-1 text-xs py-1.5 px-3 rounded-md transition-all font-medium text-center",
                                            currentValue === option
                                                ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/50 shadow-sm shadow-emerald-900/20"
                                                : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
                                        )}
                                    >
                                        {getOptionLabel(option)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )
                })}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-white/10">
                <span className="text-xs text-muted-foreground">
                    {hasChanges ? 'Changes not saved' : 'All changes saved'}
                </span>
                <Button
                    onClick={handleSave}
                    disabled={isSaving || !hasChanges}
                    className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/50 min-w-[140px]"
                >
                    {isSaving ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                        </>
                    ) : (
                        <>
                            <Save className="mr-2 h-4 w-4" />
                            Save Changes
                        </>
                    )}
                </Button>
            </div>
        </div>
    )
}
