import { getSmsCheckinSettings, getSmsCheckinLogs } from '@/lib/actions/sms-checkin'
import { SettingsLayout } from '@/components/settings/SettingsLayout'
import { SmsCheckinSettings } from '@/components/settings/SmsCheckinSettings'
import { SmsCheckinLogs } from '@/components/settings/SmsCheckinLogs'
import { Separator } from '@/components/ui/separator'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function SmsCheckinSettingsPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    // Check if user is admin
    const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

    if (!userData || !['admin', 'super_admin'].includes(userData.role)) {
        redirect('/dashboard')
    }

    const settings = await getSmsCheckinSettings()
    const { data: logs, total } = await getSmsCheckinLogs(50, 0)

    return (
        <SettingsLayout activeTab="sms-checkin">
            <div className="space-y-6">
                <div>
                    <h3 className="text-lg font-medium">SMS Check-in</h3>
                    <p className="text-sm text-muted-foreground">
                        Configure automated weekly check-in messages sent to clients via GoHighLevel.
                    </p>
                </div>

                <SmsCheckinSettings initialSettings={settings} />

                <Separator />

                <div>
                    <h3 className="text-lg font-medium">Message Log</h3>
                    <p className="text-sm text-muted-foreground">
                        View the history of check-in messages sent to clients.
                    </p>
                </div>

                <SmsCheckinLogs initialLogs={logs} initialTotal={total} />
            </div>
        </SettingsLayout>
    )
}
