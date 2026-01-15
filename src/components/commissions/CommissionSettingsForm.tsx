'use client'

import { CommissionSetting, updateCommissionSetting } from '@/lib/actions/commissions'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { toast } from 'sonner'
import { Check, Loader2 } from 'lucide-react'

interface CommissionSettingsFormProps {
    settings: CommissionSetting[]
}

export function CommissionSettingsForm({ settings }: CommissionSettingsFormProps) {
    const [loading, setLoading] = useState<string | null>(null)

    const handleSave = async (key: string, valueStr: string) => {
        const value = parseFloat(valueStr)
        if (isNaN(value) || value < 0 || value > 1) {
            toast.error('Please enter a valid decimal rate (0.00 - 1.00)')
            return
        }

        setLoading(key)
        const res = await updateCommissionSetting(key, value)
        setLoading(null)

        if (res.error) {
            toast.error(res.error)
        } else {
            toast.success('Rate updated successfully')
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
            {settings.map((setting) => (
                <Card key={setting.id} className="bg-card/40 border-primary/5">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base font-medium">
                            {friendlyNames[setting.setting_key] || setting.setting_key}
                        </CardTitle>
                        <CardDescription>{setting.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-4">
                            <div className="relative flex-1">
                                <span className="absolute left-3 top-2.5 text-muted-foreground">%</span>
                                <Input
                                    className="pl-8"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max="1"
                                    defaultValue={setting.setting_value}
                                    onBlur={(e) => {
                                        if (parseFloat(e.target.value) !== setting.setting_value) {
                                            handleSave(setting.setting_key, e.target.value)
                                        }
                                    }}
                                />
                            </div>
                            {loading === setting.setting_key && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}
