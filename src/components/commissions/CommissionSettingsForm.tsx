'use client'

import { CommissionSetting, updateCommissionSetting } from '@/lib/actions/commissions'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Percent } from 'lucide-react'

interface CommissionSettingsFormProps {
    settings: CommissionSetting[]
}

export function CommissionSettingsForm({ settings }: CommissionSettingsFormProps) {
    const [loading, setLoading] = useState<string | null>(null)

    // Convert percentage (70) to decimal (0.70) for storage
    const handleSave = async (key: string, percentageStr: string, originalDecimal: number) => {
        const percentage = parseFloat(percentageStr)
        if (isNaN(percentage) || percentage < 0 || percentage > 100) {
            toast.error('Please enter a valid percentage (0 - 100)')
            return
        }

        // Convert percentage to decimal for storage
        const decimalValue = percentage / 100
        
        // Don't save if unchanged
        if (decimalValue === originalDecimal) return

        setLoading(key)
        const res = await updateCommissionSetting(key, decimalValue)
        setLoading(null)

        if (res.error) {
            toast.error(res.error)
        } else {
            toast.success(`Rate updated to ${percentage}%`)
        }
    }

    // Friendly names map
    const friendlyNames: Record<string, string> = {
        'commission_rate_company_lead': 'Company Sourced Lead (Initial 6mo)',
        'commission_rate_coach_lead': 'Coach Sourced Lead (Initial 6mo)',
        'commission_rate_resign': 'Client Resign (Post-Initial Term)',
    }

    return (
        <div className="grid gap-4">
            {settings.map((setting) => {
                // Convert stored decimal (0.70) to display percentage (70)
                const displayPercentage = Math.round(setting.setting_value * 100)
                
                return (
                    <Card key={setting.id} className="bg-card/40 border-primary/5">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base font-medium">
                                {friendlyNames[setting.setting_key] || setting.setting_key}
                            </CardTitle>
                            <CardDescription>{setting.description}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-3">
                                <div className="relative flex-1 max-w-[120px]">
                                    <Input
                                        className="pr-10 text-right font-mono text-lg"
                                        type="number"
                                        step="1"
                                        min="0"
                                        max="100"
                                        defaultValue={displayPercentage}
                                        onBlur={(e) => {
                                            handleSave(setting.setting_key, e.target.value, setting.setting_value)
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.currentTarget.blur()
                                            }
                                        }}
                                    />
                                    <Percent className="absolute right-3 top-2.5 h-5 w-5 text-muted-foreground" />
                                </div>
                                {loading === setting.setting_key && (
                                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                )}
                                <span className="text-sm text-muted-foreground">
                                    (stored as {setting.setting_value.toFixed(2)})
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                )
            })}
        </div>
    )
}
