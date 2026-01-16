import { getClient } from '@/lib/actions/clients'
import { getClientTasks } from '@/lib/actions/onboarding'
import { getClientNotes } from '@/lib/actions/notes'
import { notFound } from 'next/navigation'
import { format } from 'date-fns'
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
import { getClientPayments } from '@/lib/actions/payments'
import { OnboardingTask } from '@/types/onboarding'
import { Note } from '@/types/client'

export default async function ClientPage(props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const client = await getClient(params.id)
    const tasksData = await getClientTasks(params.id)
    const tasks = (tasksData || []) as OnboardingTask[]
    const paymentsData = await getClientPayments(params.id)
    const payments = paymentsData || []

    // Fetch notes
    const notesData = await getClientNotes(params.id)
    const notes = (notesData || []) as Note[]

    if (!client) {
        return (
            <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
                <div className="flex items-center justify-center h-full">
                    <p className="text-muted-foreground">Client not found or access denied.</p>
                </div>
            </div>
        )
    }

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
                        </div>
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
                    <ClientDetailsCard client={client} />

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
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="onboarding">Onboarding Timeline</TabsTrigger>
                            <TabsTrigger value="notes">Notes</TabsTrigger>
                        </TabsList>
                        <TabsContent value="onboarding" className="mt-4 flex-1">
                            <Card className="bg-card/40 border-primary/5 backdrop-blur-sm h-full">
                                <CardHeader>
                                    <CardTitle>Client Journey</CardTitle>
                                    <CardDescription>Track onboarding progress and steps.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <ClientOnboardingChecklist tasks={tasks} clientId={client.id} />
                                </CardContent>
                            </Card>
                        </TabsContent>
                        <TabsContent value="notes" className="mt-4 flex-1">
                            <ClientNotes notes={notes} clientId={client.id} />
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

                    <Card className="bg-card/40 border-primary/5 backdrop-blur-sm">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-lg">Financials</CardTitle>
                            <CreditCard className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="mb-4">
                                <div className="text-2xl font-bold text-emerald-500">$0.00</div>
                                <p className="text-xs text-muted-foreground">Lifetime Revenue</p>
                            </div>
                            <Separator className="my-4 bg-primary/10" />
                            <h4 className="text-sm font-medium mb-3 text-muted-foreground">Recent Transactions</h4>
                            <ClientPaymentsList payments={payments} />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
