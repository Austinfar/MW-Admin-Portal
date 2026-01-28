import { getClient, getCoaches, getClientActivityLogs } from '@/lib/actions/clients'
import { getAllUsers } from '@/lib/actions/user-actions'
import { getClientTasks } from '@/lib/actions/onboarding'
import { getClientNotes } from '@/lib/actions/notes'
import { getClientGoals } from '@/lib/actions/goals'
import { getClientDocuments } from '@/lib/actions/documents'
import { getActiveAgreement } from '@/lib/actions/agreements'
import {
    getClientSubscription,
    getApprovalRequestsForClient,
    getActiveFreeze,
    getClientPaymentSchedule
} from '@/lib/actions/subscriptions'
import { GHL_CONFIG } from '@/lib/ghl/config'
import { differenceInDays } from 'date-fns'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ClientStickyHeader } from '@/components/clients/ClientStickyHeader'
import { ClientOverviewTab } from '@/components/clients/tabs/ClientOverviewTab'
import { ClientJourneyTab } from '@/components/clients/tabs/ClientJourneyTab'
import { ClientDocumentsTab } from '@/components/clients/tabs/ClientDocumentsTab'
import { ClientFinancialsTab } from '@/components/clients/tabs/ClientFinancialsTab'
import { ClientNotes } from '@/components/clients/ClientNotes'
import { ClientSalesCalls } from '@/components/clients/ClientSalesCalls'
import { calculateRiskIndicators } from '@/lib/logic/client-risk'
import { getClientPayments } from '@/lib/actions/payments'
import { OnboardingTask } from '@/types/onboarding'
import { Note } from '@/types/client'
import { calculateHealthScore } from '@/lib/logic/client-health'
import { getCurrentUserAccess } from '@/lib/auth-utils'
import { canManageSubscriptions as checkCanManageSubscriptions } from '@/lib/actions/subscriptions'

export default async function ClientPage(props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const client = await getClient(params.id)
    const userAccess = await getCurrentUserAccess()
    const isAdmin = userAccess?.role === 'admin' || userAccess?.role === 'super_admin'
    const isHeadCoach = userAccess?.job_title === 'head_coach'

    const tasksData = await getClientTasks(params.id)
    const tasks = (tasksData || []) as OnboardingTask[]
    const users = await getAllUsers()

    if (!client) {
        return (
            <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
                <div className="flex items-center justify-center h-full">
                    <p className="text-muted-foreground">Client not found or access denied.</p>
                </div>
            </div>
        )
    }

    const paymentsData = await getClientPayments(client.id, {
        email: client.email,
        stripeCustomerId: client.stripe_customer_id
    })
    const payments = paymentsData || []

    // Fetch notes
    const notesData = await getClientNotes(params.id)
    const notes = (notesData || []) as Note[]

    // Fetch goals
    const goals = await getClientGoals(params.id)

    // Fetch documents
    const documents = await getClientDocuments(params.id)

    // Fetch activity logs (history)
    const logs = await getClientActivityLogs(params.id)

    // Fetch active agreement for health calculation
    const activeAgreement = await getActiveAgreement(params.id)

    // Fetch subscription management data
    const subscription = await getClientSubscription(params.id)
    const pendingCancellationRequests = await getApprovalRequestsForClient(params.id)
    const pendingCancellationRequest = pendingCancellationRequests.find(r => r.status === 'pending') || null
    const activeFreeze = await getActiveFreeze(params.id)
    const paymentSchedule = await getClientPaymentSchedule(params.id)

    // Check subscription management permissions
    const canManageSubscriptions = await checkCanManageSubscriptions()
    const canManagePaymentSchedules = isAdmin || isHeadCoach ||
        (userAccess?.permissions?.can_manage_payment_schedules === true)

    // Calculate health score
    const overdueTasksCount = tasks.filter(t =>
        t.status === 'pending' && t.due_date && new Date(t.due_date) < new Date()
    ).length
    const hasFailedPayment = payments.some(p => p.status === 'failed' &&
        differenceInDays(new Date(), new Date(p.payment_date)) <= 30
    )
    const lastPayment = payments.length > 0 ? payments[0] : null

    const healthScore = calculateHealthScore({
        hasStripeCustomer: Boolean(client.stripe_customer_id),
        lastPaymentDate: lastPayment?.payment_date || null,
        lastPaymentStatus: lastPayment?.status || null,
        hasFailedPaymentRecent: hasFailedPayment,
        onboardingTotal: tasks.length,
        onboardingCompleted: tasks.filter(t => t.status === 'completed').length,
        contractEndDate: client.contract_end_date,
        status: client.status,
        hasSignedAgreement: activeAgreement?.status === 'signed',
        hasPendingAgreement: ['sent', 'viewed'].includes(activeAgreement?.status || ''),
    })

    // Calculate risk indicators
    const contractEndDays = client.contract_end_date
        ? differenceInDays(new Date(client.contract_end_date), new Date())
        : null
    const lastPaymentDaysAgo = lastPayment
        ? differenceInDays(new Date(), new Date(lastPayment.payment_date))
        : null

    const riskIndicators = calculateRiskIndicators({
        hasFailedPayment,
        lastPaymentDaysAgo,
        overdueOnboardingTasks: overdueTasksCount,
        contractEndDays,
        hasRenewalAgreement: false,
    })

    return (
        <div className="flex-1 p-4 md:p-8 pt-6">
            {/* Sticky Header */}
            <ClientStickyHeader
                client={client}
                healthScore={healthScore}
                riskIndicators={riskIndicators}
            />

            {/* Full-Width Tabs */}
            <div className="mt-6">
                <Tabs defaultValue="overview" className="w-full">
                    <TabsList className="w-full bg-card/50 backdrop-blur-sm border border-white/5 p-1 rounded-xl flex overflow-x-auto scrollbar-hidden">
                        <TabsTrigger value="overview" className="flex-1 min-w-[80px] text-xs sm:text-sm">
                            Overview
                        </TabsTrigger>
                        <TabsTrigger value="journey" className="flex-1 min-w-[80px] text-xs sm:text-sm">
                            Journey
                        </TabsTrigger>
                        <TabsTrigger value="notes" className="flex-1 min-w-[80px] text-xs sm:text-sm">
                            Notes
                        </TabsTrigger>
                        <TabsTrigger value="sales" className="flex-1 min-w-[80px] text-xs sm:text-sm">
                            Sales
                        </TabsTrigger>
                        <TabsTrigger value="documents" className="flex-1 min-w-[80px] text-xs sm:text-sm">
                            Documents
                        </TabsTrigger>
                        <TabsTrigger value="financials" className="flex-1 min-w-[80px] text-xs sm:text-sm">
                            Financials
                        </TabsTrigger>
                    </TabsList>

                    <div className="mt-6">
                        <TabsContent value="overview" className="mt-0">
                            <ClientOverviewTab
                                client={client}
                                ghlLocationId={GHL_CONFIG.LOCATION_ID}
                                users={users}
                                isAdmin={isAdmin}
                                subscription={subscription}
                                pendingCancellationRequest={pendingCancellationRequest}
                                activeFreeze={activeFreeze}
                                canManageSubscriptions={canManageSubscriptions}
                                paymentSchedule={paymentSchedule}
                                canManagePaymentSchedules={canManagePaymentSchedules}
                            />
                        </TabsContent>

                        <TabsContent value="journey" className="mt-0">
                            <ClientJourneyTab
                                client={client}
                                tasks={tasks}
                                goals={goals}
                                payments={payments}
                                users={users}
                                logs={logs || []}
                            />
                        </TabsContent>

                        <TabsContent value="notes" className="mt-0">
                            <ClientNotes notes={notes} clientId={client.id} />
                        </TabsContent>

                        <TabsContent value="sales" className="mt-0">
                            <ClientSalesCalls clientId={client.id} />
                        </TabsContent>

                        <TabsContent value="documents" className="mt-0">
                            <ClientDocumentsTab
                                clientId={client.id}
                                clientName={client.name}
                                documents={documents}
                                hasGhlContactId={Boolean(client.ghl_contact_id)}
                            />
                        </TabsContent>

                        <TabsContent value="financials" className="mt-0">
                            <ClientFinancialsTab
                                clientId={client.id}
                                stripeCustomerId={client.stripe_customer_id}
                                payments={payments}
                            />
                        </TabsContent>
                    </div>
                </Tabs>
            </div>
        </div>
    )
}
