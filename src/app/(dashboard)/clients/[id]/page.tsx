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
            <div className="flex items-start justify-between">
                <div className="flex items-center space-x-4">
                    <Avatar className="h-20 w-20 border-2 border-primary/20">
                        <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${client.name}`} />
                        <AvatarFallback>{client.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <h2 className="text-3xl font-bold tracking-tight text-foreground">{client.name}</h2>
                            <Badge variant="secondary" className={getStatusColor(client.status)}>
                                {client.status.toUpperCase()}
                            </Badge>
                            <ClientHealthScore score={healthScore} />
                        </div>
                        <ClientRiskIndicators indicators={riskIndicators} />
                        <p className="text-muted-foreground flex items-center gap-2">
                            <Mail className="h-4 w-4" /> {client.email}
                            <span className="text-gray-600">|</span>
                            <Phone className="h-4 w-4" /> {client.phone || 'No phone'}
                        </p>
                    </div>
                </div>
                <div className="flex space-x-2">
                    <Button variant="outline" className="bg-card/40 border-primary/10 hover:border-primary/30">
                        Sync GHL
                    </Button>
                </div>
            </div>

            <Separator className="bg-primary/10" />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-200px)]">
                {/* Left Column: Identity & Contact (3 cols) */}
                <div className="lg:col-span-3 space-y-6">
                    <ClientDetailsCard client={client} ghlLocationId={GHL_CONFIG.LOCATION_ID} users={users} isAdmin={isAdmin} />

                    <Card className="bg-card/40 border-primary/5 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle className="text-lg">Assigned Coach</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center gap-3">
                                <Avatar className="h-10 w-10">
                                    <AvatarFallback>C</AvatarFallback>
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
                <div className="lg:col-span-6 space-y-6 h-full flex flex-col">
                    <Tabs defaultValue="onboarding" className="w-full flex-1 flex flex-col">
                        <TabsList className="grid w-full grid-cols-4">
                            <TabsTrigger value="onboarding">Onboarding</TabsTrigger>
                            <TabsTrigger value="notes">Notes</TabsTrigger>
                            <TabsTrigger value="sales-calls">Sales Calls</TabsTrigger>
                            <TabsTrigger value="documents">Documents</TabsTrigger>
                        </TabsList>
                        <TabsContent value="onboarding" className="mt-4 flex-1">
                            <Card className="bg-card/40 border-primary/5 backdrop-blur-sm h-full">
                                <CardHeader>
                                    <CardTitle>Client Journey</CardTitle>
                                    <CardDescription>Track onboarding progress and steps.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <ClientOnboardingChecklist tasks={tasks} clientId={client.id} users={users} />
                                </CardContent>
                            </Card>
                        </TabsContent>
                        <TabsContent value="notes" className="mt-4 flex-1">
                            <ClientNotes notes={notes} clientId={client.id} />
                        </TabsContent>
                        <TabsContent value="sales-calls" className="mt-4 flex-1">
                            <ClientSalesCalls clientId={client.id} />
                        </TabsContent>
                        <TabsContent value="documents" className="mt-4 flex-1">
                            <ClientDocuments clientId={client.id} documents={documents} />
                        </TabsContent>
                    </Tabs>
                </div>

                {/* Right Column: Financials & Terms (3 cols) */}
                <div className="lg:col-span-3 space-y-6">
                    <Card className="bg-card/40 border-primary/5 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle className="text-lg">Program Terms</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex justify-between items-center border-b border-primary/5 pb-2">
                                <span className="text-sm text-muted-foreground">Type</span>
                                <Badge variant="outline">{client.client_type?.name || 'Standard'}</Badge>
                            </div>
                            <div className="flex justify-between items-center border-b border-primary/5 pb-2">
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

                    <Card className="bg-card/40 border-primary/5 backdrop-blur-sm">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-lg">Financials</CardTitle>
                            <CreditCard className="h-4 w-4 text-muted-foreground" />
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
                                            <div className={`text-2xl font-bold ${netRevenue >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(netRevenue)}
                                            </div>
                                            <p className="text-xs text-muted-foreground">Net Lifetime Revenue</p>
                                        </div>
                                        {totalRefunds > 0 && (
                                            <div className="flex justify-between text-sm border-t border-primary/10 pt-2">
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
                            <Separator className="my-4 bg-primary/10" />
                            <h4 className="text-sm font-medium mb-3 text-muted-foreground">Recent Transactions</h4>
                            <ClientPaymentsList payments={payments} clientId={client.id} stripeCustomerId={client.stripe_customer_id} />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
