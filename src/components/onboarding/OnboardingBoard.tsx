'use client'

import { Client } from '@/types/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Calendar, CheckCircle2, MoreHorizontal, ArrowRight, User, Search, Filter, SortAsc, ArrowUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { format } from 'date-fns'
import { useRouter } from 'next/navigation'
import { useState, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dumbbell } from 'lucide-react'

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
    const [searchTerm, setSearchTerm] = useState('')
    const [filterCoach, setFilterCoach] = useState('all')
    const [sortBy, setSortBy] = useState<'start_date' | 'name' | 'progress'>('start_date')
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

    const coaches = useMemo(() => {
        const uniqueCoaches = new Set<string>()
        const coachList: { id: string, name: string }[] = []
        clients.forEach(c => {
            if (c.assigned_coach?.name && !uniqueCoaches.has(c.assigned_coach.name)) {
                uniqueCoaches.add(c.assigned_coach.name)
                coachList.push({ id: c.assigned_coach.name, name: c.assigned_coach.name }) // Using name as ID for simple filtering
            }
        })
        return coachList
    }, [clients])

    const filteredClients = useMemo(() => {
        return clients
            .filter(client => {
                const matchesSearch = client.name.toLowerCase().includes(searchTerm.toLowerCase())
                const matchesCoach = filterCoach === 'all' || client.assigned_coach?.name === filterCoach
                return matchesSearch && matchesCoach
            })
            .sort((a, b) => {
                let diff = 0
                if (sortBy === 'name') {
                    diff = a.name.localeCompare(b.name)
                } else if (sortBy === 'progress') {
                    const progA = a.onboarding_progress?.percentage || 0
                    const progB = b.onboarding_progress?.percentage || 0
                    diff = progA - progB // Default asc for numbers logic here? Actually usually desc for progress? 
                    // Let's stick to simple diff and let sortOrder flip it.
                } else {
                    // Start date
                    diff = new Date(a.start_date || 0).getTime() - new Date(b.start_date || 0).getTime()
                }

                return sortOrder === 'asc' ? diff : -diff
            })
    }, [clients, searchTerm, filterCoach, sortBy, sortOrder])

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
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-card/40 p-4 rounded-lg border border-border/40">
                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search clients..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8"
                    />
                </div>
                <div className="flex gap-2 w-full sm:w-auto items-center">
                    <Select value={filterCoach} onValueChange={setFilterCoach}>
                        <SelectTrigger className="w-[160px]">
                            <Filter className="w-4 h-4 mr-2" />
                            <SelectValue placeholder="All Coaches" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Coaches</SelectItem>
                            {coaches.map(coach => (
                                <SelectItem key={coach.id} value={coach.id}>{coach.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <div className="flex items-center gap-1 border rounded-md bg-background">
                        <Select value={sortBy} onValueChange={(val: any) => setSortBy(val)}>
                            <SelectTrigger className="w-[140px] border-0 focus:ring-0">
                                <SortAsc className="w-4 h-4 mr-2" />
                                <SelectValue placeholder="Sort by" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="start_date">Start Date</SelectItem>
                                <SelectItem value="name">Name</SelectItem>
                                <SelectItem value="progress">Progress</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                            className="h-9 w-9 px-0 border-l rounded-l-none"
                            title={sortOrder === 'asc' ? "Ascending" : "Descending"}
                        >
                            <ArrowUpDown className={`h-4 w-4 transition-transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`} />
                        </Button>
                    </div>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {filteredClients.map((client) => (
                    <ClientOnboardingCard key={client.id} client={client} />
                ))}
            </div>
            {filteredClients.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                    No clients match your filter.
                </div>
            )}
        </div>
    )
}

function ClientOnboardingCard({ client }: { client: OnboardingClient }) {
    const progress = client.onboarding_progress || { total: 0, completed: 0, percentage: 0 }

    const isPastStartDate = client.start_date && new Date(client.start_date) < new Date() && progress.percentage < 100

    return (
        <Card className={cn(
            "hover:shadow-md transition-all duration-300 border-primary/10 bg-card/60 backdrop-blur-sm group",
            isPastStartDate && "border-red-500/50 bg-red-500/5 hover:bg-red-500/10 animate-pulse-slow"
        )}>
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
                {client.client_type && (
                    <div className="flex items-center gap-1.5 mt-3 text-xs text-primary/80 font-medium bg-primary/5 p-1.5 rounded w-fit">
                        <Dumbbell className="h-3 w-3" />
                        {client.client_type.name}
                    </div>
                )}
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
