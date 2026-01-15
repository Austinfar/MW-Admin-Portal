import { getOnboardingTemplates } from '@/lib/actions/onboarding'
import { OnboardingTemplatesList } from '@/components/onboarding/OnboardingTemplatesList'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import { AddTemplateDialog } from '@/components/onboarding/AddTemplateDialog'

export default async function OnboardingTemplatesPage() {
    const templates = await getOnboardingTemplates()

    return (
        <div className="flex-1 space-y-6">
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-foreground">Onboarding Templates</h2>
                    <p className="text-muted-foreground">
                        Create and manage reusable onboarding checklists for your clients.
                    </p>
                </div>
                <AddTemplateDialog />
            </div>
            <OnboardingTemplatesList initialTemplates={templates} />
        </div>
    )
}
