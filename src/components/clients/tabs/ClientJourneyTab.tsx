'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ClientOnboardingChecklist } from '@/components/clients/ClientOnboardingChecklist'
import { ClientGoals } from '@/components/clients/ClientGoals'
import { ClientActivityTimeline } from '@/components/clients/ClientActivityTimeline'
import { Client, ClientGoal } from '@/types/client'
import { OnboardingTask } from '@/types/onboarding'
import { Payment } from '@/types/payment'
import { Coach } from '@/lib/actions/clients'

interface ClientJourneyTabProps {
    client: Client
    tasks: OnboardingTask[]
    goals: ClientGoal[]
    payments: Payment[]
    users: Coach[]
    logs?: any[]
}

export function ClientJourneyTab({ client, tasks, goals, payments, users, logs }: ClientJourneyTabProps) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Onboarding + Goals (2/3 width) */}
            <div className="lg:col-span-2 space-y-6">
                <Card className="bg-card/50 backdrop-blur-xl border-white/5 hover:border-primary/20 transition-all duration-300 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]">
                    <CardHeader>
                        <CardTitle>Client Journey</CardTitle>
                        <CardDescription>Track onboarding progress and milestones</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ClientOnboardingChecklist tasks={tasks} clientId={client.id} users={users} />
                    </CardContent>
                </Card>

                <ClientGoals clientId={client.id} goals={goals} />
            </div>

            {/* Right Column: Activity Timeline (1/3 width) */}
            <div className="lg:col-span-1">
                <ClientActivityTimeline client={client} tasks={tasks} payments={payments} logs={logs} />
            </div>
        </div>
    )
}
