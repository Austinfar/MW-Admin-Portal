import { getAllClientTypes } from '@/lib/actions/settings'
import { getOnboardingTemplates } from '@/lib/actions/onboarding'
import { ClientTypesManager } from '@/components/settings/ClientTypesManager'
import { Separator } from '@/components/ui/separator'
import { getGHLPipelines } from '@/lib/actions/ghl'
import { GHLSyncSettings } from '@/components/settings/GHLSyncSettings'
import { getAppSettings } from '@/lib/actions/app-settings'
import { GHLConnectionSettings } from '@/components/settings/GHLConnectionSettings'
import { ApiConnectionStatus } from '@/components/settings/ApiConnectionStatus'
import { StripeSyncSettings } from '@/components/settings/StripeSyncSettings'
import { SettingsLayout } from '@/components/settings/SettingsLayout'

export default async function SettingsPage() {
    const clientTypes = await getAllClientTypes()
    const onboardingTemplates = await getOnboardingTemplates()
    const { pipelines } = await getGHLPipelines()
    const settings = await getAppSettings()

    return (
        <SettingsLayout activeTab="general">
            <div className="space-y-6">
                <div>
                    <h3 className="text-lg font-medium">Coaching Programs</h3>
                    <p className="text-sm text-muted-foreground">
                        Configure the types of coaching services you offer.
                    </p>
                </div>
                <ClientTypesManager initialTypes={clientTypes} onboardingTemplates={onboardingTemplates} />

                <Separator />

                <div>
                    <h3 className="text-lg font-medium">Integrations</h3>
                    <p className="text-sm text-muted-foreground">
                        Manage external service connections.
                    </p>
                </div>

                {/* API Connection Status */}
                <ApiConnectionStatus />

                {/* GoHighLevel Settings */}
                <GHLConnectionSettings
                    initialAccessToken={settings['ghl_access_token']}
                    initialRefreshToken={settings['ghl_refresh_token']}
                    initialLocationId={settings['ghl_location_id']}
                />
                <GHLSyncSettings
                    pipelines={pipelines}
                    initialPipelineId={settings['ghl_sync_pipeline_id']}
                />

                {/* Stripe Settings */}
                <StripeSyncSettings />
            </div>
        </SettingsLayout>
    )
}
