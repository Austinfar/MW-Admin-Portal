'use client'

import { useState, useTransition } from 'react'
import { Bell, X, AlertTriangle, CreditCard, Calendar, ListTodo } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ClientAlert } from '@/types/client'
import { dismissAlert } from '@/lib/actions/alerts'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'

interface AlertBellProps {
    alerts: ClientAlert[]
    count: number
}

const ALERT_ICONS: Record<ClientAlert['alert_type'], typeof AlertTriangle> = {
    payment_failed: CreditCard,
    payment_overdue: CreditCard,
    contract_expiring: Calendar,
    onboarding_stalled: ListTodo,
}

const ALERT_COLORS: Record<ClientAlert['severity'], string> = {
    warning: 'text-amber-500',
    critical: 'text-red-500',
}

export function AlertBell({ alerts, count }: AlertBellProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [isPending, startTransition] = useTransition()
    const [localAlerts, setLocalAlerts] = useState(alerts)

    const handleDismiss = (alertId: string, e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()

        // Optimistic update
        setLocalAlerts(prev => prev.filter(a => a.id !== alertId))

        startTransition(async () => {
            const result = await dismissAlert(alertId)
            if (result.error) {
                toast.error('Failed to dismiss alert')
                // Revert on error
                setLocalAlerts(alerts)
            }
        })
    }

    const activeAlerts = localAlerts.filter(a => !a.is_dismissed)
    const activeCount = activeAlerts.length

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-5 w-5" />
                    {activeCount > 0 && (
                        <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-[10px] font-medium text-white flex items-center justify-center">
                            {activeCount > 9 ? '9+' : activeCount}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
                <div className="flex items-center justify-between px-4 py-3 border-b">
                    <h4 className="font-semibold">Alerts</h4>
                    {activeCount > 0 && (
                        <Badge variant="secondary" className="text-xs">
                            {activeCount} active
                        </Badge>
                    )}
                </div>

                {activeAlerts.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                        <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No active alerts</p>
                    </div>
                ) : (
                    <ScrollArea className="max-h-[400px]">
                        <div className="divide-y">
                            {activeAlerts.map((alert) => {
                                const Icon = ALERT_ICONS[alert.alert_type]
                                const colorClass = ALERT_COLORS[alert.severity]

                                return (
                                    <Link
                                        key={alert.id}
                                        href={`/clients/${alert.client_id}`}
                                        className="flex items-start gap-3 p-4 hover:bg-muted/50 transition-colors"
                                        onClick={() => setIsOpen(false)}
                                    >
                                        <div className={`mt-0.5 ${colorClass}`}>
                                            <Icon className="h-4 w-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <p className="text-sm font-medium leading-tight">
                                                        {alert.title}
                                                    </p>
                                                    {alert.client && (
                                                        <p className="text-xs text-muted-foreground mt-0.5">
                                                            {alert.client.name}
                                                        </p>
                                                    )}
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 hover:opacity-100"
                                                    onClick={(e) => handleDismiss(alert.id, e)}
                                                    disabled={isPending}
                                                >
                                                    <X className="h-3 w-3" />
                                                </Button>
                                            </div>
                                            {alert.description && (
                                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                                    {alert.description}
                                                </p>
                                            )}
                                            <p className="text-xs text-muted-foreground/70 mt-1">
                                                {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                                            </p>
                                        </div>
                                    </Link>
                                )
                            })}
                        </div>
                    </ScrollArea>
                )}
            </PopoverContent>
        </Popover>
    )
}
