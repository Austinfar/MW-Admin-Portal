import { getCommissionSettings } from '@/lib/actions/commissions'
import { CommissionSettingsForm } from '@/components/commissions/CommissionSettingsForm'
import { Separator } from '@/components/ui/separator'

export default async function CommissionSettingsPage() {
    const settings = await getCommissionSettings()

    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Commission Settings</h2>
                    <p className="text-muted-foreground">
                        Configure global commission rates for automated calculations.
                    </p>
                </div>
            </div>

            <Separator />

            <div className="max-w-2xl">
                <CommissionSettingsForm settings={settings} />
            </div>
        </div>
    )
}
