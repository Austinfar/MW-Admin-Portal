import { OnboardingSettings } from '@/components/settings/onboarding/OnboardingSettings'
import { SettingsLayout } from '@/components/settings/SettingsLayout'
import { getOnboardingTemplates } from '@/lib/actions/onboarding'
import { getCoaches } from '@/lib/actions/clients'

export default async function OnboardingSettingsPage() {
    // We fetch initial data on the server to pass to the client component
    const templates = await getOnboardingTemplates()
    const users = await getCoaches()

    return (
        <SettingsLayout activeTab="onboarding">
            <OnboardingSettings initialTemplates={templates} users={users} />
        </SettingsLayout>
    )
}

