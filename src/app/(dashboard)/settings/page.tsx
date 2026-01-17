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

export default async function SettingsPage() {
    const clientTypes = await getAllClientTypes()
    const onboardingTemplates = await getOnboardingTemplates()
    const { pipelines } = await getGHLPipelines()
    const settings = await getAppSettings()

    return (
        <div className="flex-1 space-y-6">
            <div className="space-y-0.5">
                <h2 className="text-2xl font-bold tracking-tight text-foreground">Settings</h2>
                <p className="text-muted-foreground">
                    Manage your dashboard configurations and preferences.
                </p>
            </div>
            <Separator className="my-6" />
            <div className="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0">
                <aside className="-mx-4 lg:w-1/5">
                    <nav className="flex space-x-2 lg:flex-col lg:space-x-0 lg:space-y-1">
                        <span className="justify-start inline-flex items-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2 bg-muted hover:bg-muted">
                            General
                        </span>
                        <span className="justify-start inline-flex items-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2 text-muted-foreground">
                            Team (Coming Soon)
                        </span>
                    </nav>
                </aside>
                <div className="flex-1 lg:max-w-2xl">
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
                            initialLocationId={settings['ghl_location_id']}
                        />
                        <GHLSyncSettings pipelines={pipelines} />

                        {/* Stripe Settings */}
                        <StripeSyncSettings />
                    </div>
                </div>
            </div>
        </div>
    )
}
