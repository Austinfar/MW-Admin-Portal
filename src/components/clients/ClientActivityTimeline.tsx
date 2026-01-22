'use client'

import { OnboardingTask } from '@/types/onboarding'
import { Payment } from '@/types/payment'
import { Client } from '@/types/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, CreditCard, UserPlus, Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface ActivityItem {
    id: string
    type: 'payment' | 'task_completion' | 'client_created'
    date: Date
    title: string
    description?: string
    metadata?: any
}

interface ClientActivityTimelineProps {
    client: Client
    tasks: OnboardingTask[]
    payments: Payment[]
}

export function ClientActivityTimeline({ client, tasks, payments }: ClientActivityTimelineProps) {
    // 1. Aggregate events
    const activities: ActivityItem[] = []

    // Client Creation
    if (client.created_at) {
        activities.push({
            id: 'creation',
            type: 'client_created',
            date: new Date(client.created_at),
            title: 'Client Profile Created',
            description: `Joined via ${client.lead_source?.replace('_', ' ') || 'unknown source'}`
        })
    }

    // Payments
    payments.forEach(p => {
        activities.push({
            id: p.id,
            type: 'payment',
            date: new Date(p.payment_date),
            title: `Payment: ${p.status}`,
            description: `${new Intl.NumberFormat('en-US', { style: 'currency', currency: p.currency }).format(p.amount)} - ${p.product_name || 'Stripe Charge'}`,
            metadata: { status: p.status }
        })
    })

    // Completed Tasks
    tasks.filter(t => t.status === 'completed' && t.completed_at).forEach(t => {
        activities.push({
            id: t.id,
            type: 'task_completion',
            date: new Date(t.completed_at!),
            title: 'Task Completed',
            description: t.title
        })
    })

    // Sort by date desc
    activities.sort((a, b) => b.date.getTime() - a.date.getTime())

    if (activities.length === 0) {
        return (
            <Card className="bg-card/50 backdrop-blur-xl border-white/5 hover:border-primary/20 transition-all duration-300 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]">
                <CardHeader>
                    <CardTitle>Activity Timeline</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center text-muted-foreground text-sm py-4">No activity recorded.</div>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="bg-card/50 backdrop-blur-xl border-white/5 hover:border-primary/20 transition-all duration-300 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)] lg:flex lg:flex-col overflow-hidden">
            <CardHeader className="shrink-0">
                <CardTitle>Activity Timeline</CardTitle>
            </CardHeader>
            <CardContent className="lg:flex-1 lg:overflow-y-auto max-h-[400px] lg:max-h-none scrollbar-thin">
                <div className="relative space-y-0 pl-4 border-l-2 border-muted">
                    {activities.map((item, i) => (
                        <div key={item.id} className="mb-6 relative group">
                            {/* Dot */}
                            <div className="absolute -left-[23px] top-1 h-3.5 w-3.5 rounded-full border-2 border-background bg-muted-foreground/30 group-hover:bg-primary transition-colors">
                                {item.type === 'payment' && <div className="absolute inset-0 bg-emerald-500 rounded-full opacity-50" />}
                                {item.type === 'task_completion' && <div className="absolute inset-0 bg-blue-500 rounded-full opacity-50" />}
                            </div>

                            <div className="flex flex-col space-y-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-muted-foreground uppercase opacity-70">
                                        {formatDistanceToNow(item.date, { addSuffix: true })}
                                    </span>
                                    {getIcon(item.type)}
                                </div>

                                <h4 className="text-sm font-semibold">{item.title}</h4>
                                <p className="text-sm text-muted-foreground">{item.description}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}

function getIcon(type: ActivityItem['type']) {
    switch (type) {
        case 'payment':
            return <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-emerald-500/30 text-emerald-500 bg-emerald-500/5">Payment</Badge>
        case 'task_completion':
            return <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-blue-500/30 text-blue-500 bg-blue-500/5">Onboarding</Badge>
        case 'client_created':
            return <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">System</Badge>
        default:
            return null
    }
}
