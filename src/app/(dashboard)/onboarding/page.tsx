
import { getOnboardingClients } from '@/lib/actions/onboarding'
import { OnboardingBoard } from '@/components/onboarding/OnboardingBoard'

export default async function OnboardingPage() {
    const clients = await getOnboardingClients()

    return (
        <div className="space-y-6 p-2">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Onboarding Pipeline</h2>
                <p className="text-muted-foreground">
                    Manage active client onboarding workflows and progress.
                </p>
            </div>

            <OnboardingBoard clients={clients} />
        </div>
    )
}
