'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ClientDetailsCard } from '@/components/clients/ClientDetailsCard'
import { SubscriptionManagementCard } from '@/components/clients/SubscriptionManagementCard'
import { PaymentScheduleCard } from '@/components/clients/PaymentScheduleCard'
import { MonthlyCoachingLinkCard } from '@/components/clients/MonthlyCoachingLinkCard'
import { ContractHistoryCard } from '@/components/clients/ContractHistoryCard'
import { CreateContractDialog } from '@/components/clients/CreateContractDialog'
import { RenewContractDialog } from '@/components/clients/RenewContractDialog'
import { Client } from '@/types/client'
import { Coach } from '@/lib/actions/clients'
import type { ClientSubscription, ApprovalRequest, SubscriptionFreeze, PaymentScheduleSummary } from '@/types/subscription'

interface ClientOverviewTabProps {
    client: Client
    ghlLocationId?: string
    users: Coach[]
    isAdmin: boolean
    // Subscription management props
    subscription?: ClientSubscription | null
    pendingCancellationRequest?: ApprovalRequest | null
    activeFreeze?: SubscriptionFreeze | null
    canManageSubscriptions?: boolean
    // Payment schedule props
    paymentSchedule?: PaymentScheduleSummary | null
    canManagePaymentSchedules?: boolean
}

export function ClientOverviewTab({
    client,
    ghlLocationId,
    users,
    isAdmin,
    subscription,
    pendingCancellationRequest,
    activeFreeze,
    canManageSubscriptions = false,
    paymentSchedule,
    canManagePaymentSchedules = false
}: ClientOverviewTabProps) {
    // Contract dialog state
    const [showCreateContract, setShowCreateContract] = useState(false)
    const [showRenewContract, setShowRenewContract] = useState(false)
    const [renewContractId, setRenewContractId] = useState<string | null>(null)
    const [contractRefreshKey, setContractRefreshKey] = useState(0)

    const handleContractCreated = () => {
        setContractRefreshKey(k => k + 1)
    }

    const handleRenewContract = (contractId: string) => {
        setRenewContractId(contractId)
        setShowRenewContract(true)
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column: Contact Details & Coach */}
            <div className="space-y-6">
                <ClientDetailsCard
                    client={client}
                    ghlLocationId={ghlLocationId}
                    users={users}
                    isAdmin={isAdmin}
                />

                <Card className="bg-card/50 backdrop-blur-xl border-white/5 hover:border-primary/20 transition-all duration-300 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">Assigned Coach</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10 ring-2 ring-primary/20 shrink-0">
                                <AvatarFallback className="bg-primary/10 text-primary">
                                    {client.assigned_coach?.name?.substring(0, 1) || 'C'}
                                </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                                <div className="font-medium text-sm truncate">
                                    {client.assigned_coach?.name || 'Unassigned'}
                                </div>
                                <div className="text-xs text-muted-foreground truncate">
                                    {client.assigned_coach?.email}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Monthly Coaching Link */}
                <MonthlyCoachingLinkCard
                    coachId={client.assigned_coach_id}
                    coachName={client.assigned_coach?.name}
                    clientName={client.name}
                />
            </div>

            {/* Right Column: Program Terms, Subscription, Payment Schedule */}
            <div className="space-y-6">
                {/* Contract History Card */}
                <ContractHistoryCard
                    clientId={client.id}
                    onCreateContract={() => setShowCreateContract(true)}
                    onRenewContract={handleRenewContract}
                    refreshTrigger={contractRefreshKey}
                />

                {/* Subscription Management Card */}
                <SubscriptionManagementCard
                    clientId={client.id}
                    clientName={client.name}
                    subscription={subscription || null}
                    canManage={canManageSubscriptions}
                    pendingRequest={pendingCancellationRequest}
                    activeFreeze={activeFreeze}
                />

                {/* Payment Schedule Card */}
                <PaymentScheduleCard
                    clientId={client.id}
                    schedule={paymentSchedule || null}
                    canEdit={canManagePaymentSchedules}
                />
            </div>

            {/* Contract Dialogs */}
            <CreateContractDialog
                clientId={client.id}
                open={showCreateContract}
                onOpenChange={setShowCreateContract}
                onSuccess={handleContractCreated}
            />

            {renewContractId && (
                <RenewContractDialog
                    clientId={client.id}
                    previousContractId={renewContractId}
                    open={showRenewContract}
                    onOpenChange={(open) => {
                        setShowRenewContract(open)
                        if (!open) setRenewContractId(null)
                    }}
                    onSuccess={handleContractCreated}
                />
            )}
        </div>
    )
}
