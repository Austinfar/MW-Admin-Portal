
import { getOnboardingClients } from '@/lib/actions/onboarding'
import { OnboardingBoard } from '@/components/onboarding/OnboardingBoard'

import { protectRoute } from '@/lib/protect-route'

import { RefreshOnboardingButton } from '@/components/onboarding/RefreshOnboardingButton'

export default async function OnboardingPage() {
    await protectRoute('can_view_onboarding')

    const clients = await getOnboardingClients()

    return (
        <div className="space-y-6 p-2">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Onboarding Pipeline</h2>
                    <p className="text-muted-foreground">
                        Manage active client onboarding workflows and progress.
                    </p>
                </div>
                <RefreshOnboardingButton />
            </div>

            <OnboardingBoard clients={clients} />
        </div>
    )
}
