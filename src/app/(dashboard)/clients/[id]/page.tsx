import { getClient, getCoaches } from '@/lib/actions/clients'
import { getClientTasks } from '@/lib/actions/onboarding'
import { getClientNotes } from '@/lib/actions/notes'
import { getClientGoals } from '@/lib/actions/goals'
import { getClientDocuments } from '@/lib/actions/documents'
import { getActiveAgreement } from '@/lib/actions/agreements'
import { GHL_CONFIG } from '@/lib/ghl/config'
import { notFound } from 'next/navigation'
import { format, differenceInDays } from 'date-fns'
import { Calendar, Mail, Phone, CreditCard, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ClientOnboardingChecklist } from '@/components/clients/ClientOnboardingChecklist'
import { ClientPaymentsList } from '@/components/clients/ClientPaymentsList'
import { ClientDetailsCard } from '@/components/clients/ClientDetailsCard'
import { ClientNotes } from '@/components/clients/ClientNotes'
import { ClientActivityTimeline } from '@/components/clients/ClientActivityTimeline'
import { ClientSalesCalls } from '@/components/clients/ClientSalesCalls'
import { AgreementSection } from '@/components/clients/AgreementSection'
import { ClientHealthScore } from '@/components/clients/ClientHealthScore'
import { ClientRiskIndicators } from '@/components/clients/ClientRiskIndicators'
import { ClientGoals } from '@/components/clients/ClientGoals'
import { calculateRiskIndicators } from '@/lib/logic/client-risk'
import { ClientDocuments } from '@/components/clients/ClientDocuments'
import { getClientPayments } from '@/lib/actions/payments'
import { OnboardingTask } from '@/types/onboarding'
import { Note } from '@/types/client'
import { calculateHealthScore } from '@/lib/logic/client-health'

import { getCurrentUserAccess } from '@/lib/auth-utils'

export default async function ClientPage(props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const client = await getClient(params.id)
    const userAccess = await getCurrentUserAccess()
    const isAdmin = userAccess?.role === 'admin' || userAccess?.role === 'super_admin'

    const tasksData = await getClientTasks(params.id)
    const tasks = (tasksData || []) as OnboardingTask[]
    const users = await getCoaches() // Fetch potential sellers
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

    // Fetch active agreement for health calculation
    const activeAgreement = await getActiveAgreement(params.id)

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
        hasRenewalAgreement: false, // TODO: check for renewal agreement
    })

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active':
                return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
            case 'inactive':
                return 'bg-gray-500/15 text-gray-700 dark:text-gray-400'
            case 'lost':
                return 'bg-red-500/15 text-red-700 dark:text-red-400'
            default:
                return 'bg-gray-500/15 text-gray-700'
        }
    }

    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            {/* Header Area */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <Avatar className="h-16 w-16 sm:h-20 sm:w-20 ring-2 ring-primary/30 ring-offset-2 ring-offset-background shrink-0 shadow-[0_0_20px_var(--glow-primary)]">
                        <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${client.name}`} />
                        <AvatarFallback className="bg-primary/10 text-primary font-bold">{client.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground truncate">{client.name}</h2>
                            <Badge variant="secondary" className={getStatusColor(client.status)}>
                                {client.status.toUpperCase()}
                            </Badge>
                            <ClientHealthScore score={healthScore} />
                        </div>
                        <ClientRiskIndicators indicators={riskIndicators} />
                        <div className="text-muted-foreground flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-sm">
                            <span className="flex items-center gap-1.5 truncate">
                                <Mail className="h-4 w-4 shrink-0" />
                                <span className="truncate">{client.email}</span>
                            </span>
                            <span className="hidden sm:inline text-gray-600">|</span>
                            <span className="flex items-center gap-1.5">
                                <Phone className="h-4 w-4 shrink-0" /> {client.phone || 'No phone'}
                            </span>
                        </div>
                    </div>
                </div>
                <div className="flex space-x-2 shrink-0">
                    <Button variant="outline" size="sm" className="bg-card/50 backdrop-blur-sm border-white/10 hover:border-primary/30 hover:bg-primary/10 transition-all duration-200">
                        Sync GHL
                    </Button>
                </div>
            </div>

            <Separator className="bg-white/5" />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 md:gap-6 lg:min-h-[calc(100vh-220px)]">
                {/* Left Column: Identity & Contact (3 cols) */}
                <div className="md:col-span-1 lg:col-span-3 space-y-4 md:space-y-6 order-2 md:order-1 lg:overflow-y-auto lg:max-h-[calc(100vh-220px)] lg:pr-2 lg:scrollbar-thin">
                    <ClientDetailsCard client={client} ghlLocationId={GHL_CONFIG.LOCATION_ID} users={users} isAdmin={isAdmin} />

                    <Card className="bg-card/50 backdrop-blur-xl border-white/5 hover:border-primary/20 transition-all duration-300 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]">
                        <CardHeader>
                            <CardTitle className="text-lg">Assigned Coach</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center gap-3">
                                <Avatar className="h-10 w-10 ring-2 ring-primary/20">
                                    <AvatarFallback className="bg-primary/10 text-primary">C</AvatarFallback>
                                </Avatar>
                                <div>
                                    <div className="font-medium text-sm">{client.assigned_coach?.name || 'Unassigned'}</div>
                                    <div className="text-xs text-muted-foreground">{client.assigned_coach?.email}</div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <ClientActivityTimeline client={client} tasks={tasks} payments={payments} />
                </div>

                {/* Main Column: Journey & Timeline (6 cols) */}
                <div className="md:col-span-2 lg:col-span-6 space-y-4 md:space-y-6 lg:max-h-[calc(100vh-220px)] flex flex-col order-1 md:order-2">
                    <Tabs defaultValue="onboarding" className="w-full flex-1 flex flex-col min-h-0">
                        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 shrink-0">
                            <TabsTrigger value="onboarding" className="text-xs sm:text-sm">Onboarding</TabsTrigger>
                            <TabsTrigger value="notes" className="text-xs sm:text-sm">Notes</TabsTrigger>
                            <TabsTrigger value="sales-calls" className="text-xs sm:text-sm">Sales Calls</TabsTrigger>
                            <TabsTrigger value="documents" className="text-xs sm:text-sm">Documents</TabsTrigger>
                        </TabsList>
                        <TabsContent value="onboarding" className="mt-4 flex-1 min-h-0 overflow-hidden">
                            <Card className="bg-card/50 backdrop-blur-xl border-white/5 hover:border-primary/20 transition-all duration-300 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)] h-full flex flex-col">
                                <CardHeader className="shrink-0">
                                    <CardTitle>Client Journey</CardTitle>
                                    <CardDescription>Track onboarding progress and steps.</CardDescription>
                                </CardHeader>
                                <CardContent className="flex-1 overflow-y-auto scrollbar-thin">
                                    <ClientOnboardingChecklist tasks={tasks} clientId={client.id} users={users} />
                                </CardContent>
                            </Card>
                        </TabsContent>
                        <TabsContent value="notes" className="mt-4 flex-1 min-h-0 overflow-hidden">
                            <ClientNotes notes={notes} clientId={client.id} />
                        </TabsContent>
                        <TabsContent value="sales-calls" className="mt-4 flex-1 min-h-0 overflow-hidden">
                            <ClientSalesCalls clientId={client.id} />
                        </TabsContent>
                        <TabsContent value="documents" className="mt-4 flex-1 min-h-0 overflow-hidden">
                            <ClientDocuments clientId={client.id} documents={documents} />
                        </TabsContent>
                    </Tabs>
                </div>

                {/* Right Column: Financials & Terms (3 cols) */}
                <div className="md:col-span-1 lg:col-span-3 space-y-4 md:space-y-6 order-3 lg:overflow-y-auto lg:max-h-[calc(100vh-220px)] lg:pl-2 lg:scrollbar-thin">
                    <Card className="bg-card/50 backdrop-blur-xl border-white/5 hover:border-primary/20 transition-all duration-300 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]">
                        <CardHeader>
                            <CardTitle className="text-lg">Program Terms</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                <span className="text-sm text-muted-foreground">Type</span>
                                <Badge variant="outline" className="border-primary/30 bg-primary/5">{client.client_type?.name || 'Standard'}</Badge>
                            </div>
                            <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                <span className="text-sm text-muted-foreground">Start Date</span>
                                <span className="text-sm font-medium">{format(new Date(client.start_date), 'MMM d, yyyy')}</span>
                            </div>
                            <div className="flex justify-between items-center pb-2">
                                <span className="text-sm text-muted-foreground">End Date</span>
                                <span className="text-sm font-medium">
                                    {client.contract_end_date
                                        ? format(new Date(client.contract_end_date), 'MMM d, yyyy')
                                        : <span className="text-muted-foreground italic">Open-ended</span>}
                                </span>
                            </div>
                        </CardContent>
                    </Card>

                    <AgreementSection
                        clientId={client.id}
                        clientName={client.name}
                        hasGhlContactId={Boolean(client.ghl_contact_id)}
                    />

                    <ClientGoals clientId={client.id} goals={goals} />

                    <Card className="bg-card/50 backdrop-blur-xl border-white/5 hover:border-primary/20 transition-all duration-300 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-lg">Financials</CardTitle>
                            <div className="p-2 rounded-full bg-emerald-500/10">
                                <CreditCard className="h-4 w-4 text-emerald-500" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            {(() => {
                                // Calculate financial totals
                                const grossRevenue = payments
                                    .filter(p => p.status === 'succeeded' || p.status === 'refunded' || p.status === 'partially_refunded')
                                    .reduce((sum, p) => sum + p.amount, 0)
                                const totalRefunds = payments.reduce((sum, p) => sum + (p.refund_amount || 0), 0)
                                const netRevenue = grossRevenue - totalRefunds

                                return (
                                    <div className="mb-4 space-y-3">
                                        <div>
                                            <div className={`text-xl sm:text-2xl font-bold ${netRevenue >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(netRevenue)}
                                            </div>
                                            <p className="text-xs text-muted-foreground">Net Lifetime Revenue</p>
                                        </div>
                                        {totalRefunds > 0 && (
                                            <div className="flex flex-col xs:flex-row xs:justify-between gap-1 text-sm border-t border-white/5 pt-2">
                                                <div>
                                                    <span className="text-muted-foreground">Gross:</span>
                                                    <span className="ml-1 font-medium">
                                                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(grossRevenue)}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-muted-foreground">Refunds:</span>
                                                    <span className="ml-1 font-medium text-red-500">
                                                        -{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalRefunds)}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )
                            })()}
                            <Separator className="my-4 bg-white/5" />
                            <h4 className="text-sm font-medium mb-3 text-muted-foreground">Recent Transactions</h4>
                            <ClientPaymentsList payments={payments} clientId={client.id} stripeCustomerId={client.stripe_customer_id} />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
