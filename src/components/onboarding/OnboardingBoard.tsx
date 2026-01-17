'use client'

import { Client } from '@/types/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Calendar, CheckCircle2, MoreHorizontal, ArrowRight, User } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { useRouter } from 'next/navigation'

interface OnboardingClient extends Client {
    onboarding_progress?: {
        total: number
        completed: number
        percentage: number
    }
}

interface OnboardingBoardProps {
    clients: OnboardingClient[]
}

export function OnboardingBoard({ clients }: OnboardingBoardProps) {
    const router = useRouter()

    if (clients.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center border rounded-lg bg-card/50 border-dashed">
                <div className="bg-primary/10 p-4 rounded-full mb-4">
                    <User className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">No clients in onboarding</h3>
                <p className="text-muted-foreground max-w-sm mb-6">
                    Clients will appear here when their status is set to "Onboarding".
                </p>
                <Button onClick={() => router.push('/clients')}>
                    Go to All Clients
                </Button>
            </div>
        )
    }

    return (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {clients.map((client) => (
                <ClientOnboardingCard key={client.id} client={client} />
            ))}
        </div>
    )
}

function ClientOnboardingCard({ client }: { client: OnboardingClient }) {
    const progress = client.onboarding_progress || { total: 0, completed: 0, percentage: 0 }

    return (
        <Card className="hover:shadow-md transition-all duration-300 border-primary/10 bg-card/60 backdrop-blur-sm group">
            <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                    <div className="flex gap-3 items-center">
                        <Avatar className="h-10 w-10 border border-primary/20">
                            <AvatarFallback>{client.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                            <CardTitle className="text-base font-semibold group-hover:text-primary transition-colors">
                                <Link href={`/clients/${client.id}`} className="hover:underline">
                                    {client.name}
                                </Link>
                            </CardTitle>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                <User className="h-3 w-3" />
                                <span>{client.assigned_coach?.name || 'Unassigned'}</span>
                            </div>
                        </div>
                    </div>
                    <Badge variant={progress.percentage === 100 ? "default" : "secondary"} className="ml-auto">
                        {progress.completed}/{progress.total} Tasks
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="pb-3">
                <div className="space-y-4">
                    <div className="space-y-1.5">
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Progress</span>
                            <span>{progress.percentage}%</span>
                        </div>
                        <Progress value={progress.percentage} className="h-2" />
                    </div>

                    <div className="bg-muted/30 rounded-md p-3 text-sm border border-border/50">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                            <Calendar className="h-3.5 w-3.5" />
                            <span className="text-xs font-medium uppercase tracking-wider">Start Date</span>
                        </div>
                        <p className="font-medium">
                            {client.start_date ? format(new Date(client.start_date), 'MMMM d, yyyy') : 'Not set'}
                        </p>
                    </div>
                </div>
            </CardContent>
            <CardFooter className="pt-2 flex gap-2">
                <Link href={`/clients/${client.id}?tab=onboarding`} className="w-full">
                    <Button className="w-full group-hover:bg-primary/90" variant="outline" size="sm">
                        Manage Onboarding <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
                    </Button>
                </Link>
            </CardFooter>
        </Card>
    )
}
