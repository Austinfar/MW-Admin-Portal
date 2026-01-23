'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, CreditCard, CheckSquare, ArrowRight } from 'lucide-react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { AlertItem } from '@/lib/actions/dashboard-data'

interface AlertsWidgetProps {
    alerts: AlertItem[]
    delay?: number
}

export function AlertsWidget({ alerts, delay = 0 }: AlertsWidgetProps) {
    if (alerts.length === 0) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                    duration: 0.4,
                    delay: delay * 0.1,
                    ease: [0.25, 0.46, 0.45, 0.94]
                }}
            >
                <Card className="bg-zinc-900/40 backdrop-blur-xl border-white/5 shadow-2xl">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <AlertCircle className="h-4 w-4" />
                            Alerts
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-sm text-muted-foreground text-center py-4">
                            No alerts at this time
                        </div>
                    </CardContent>
                </Card>
            </motion.div>
        )
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
                duration: 0.4,
                delay: delay * 0.1,
                ease: [0.25, 0.46, 0.45, 0.94]
            }}
        >
            <Card className="bg-red-950/40 backdrop-blur-xl border-red-500/20 shadow-lg shadow-red-900/20">
                <CardHeader className="pb-3">
                    <CardTitle className="text-red-500 text-sm font-semibold flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 animate-pulse" />
                        Alerts ({alerts.length})
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        {alerts.map((alert, index) => (
                            <AlertItemRow key={alert.id} alert={alert} index={index} />
                        ))}
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    )
}

function AlertItemRow({ alert, index }: { alert: AlertItem; index: number }) {
    const getIcon = () => {
        switch (alert.type) {
            case 'failed_payment':
                return <CreditCard className="h-4 w-4" />
            case 'overdue_task':
                return <CheckSquare className="h-4 w-4" />
            default:
                return <AlertCircle className="h-4 w-4" />
        }
    }

    const getSeverityStyles = () => {
        switch (alert.severity) {
            case 'error':
                return 'text-red-400 bg-red-500/10 border-red-500/20'
            case 'warning':
                return 'text-amber-400 bg-amber-500/10 border-amber-500/20'
            default:
                return 'text-blue-400 bg-blue-500/10 border-blue-500/20'
        }
    }

    const content = (
        <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className={cn(
                'flex items-center justify-between p-2 rounded-lg border transition-colors cursor-pointer group',
                getSeverityStyles(),
                alert.href && 'hover:bg-white/5'
            )}
        >
            <div className="flex items-center gap-3">
                <div className={cn(
                    'p-1.5 rounded-full',
                    alert.severity === 'error' ? 'bg-red-500/20' : 'bg-amber-500/20'
                )}>
                    {getIcon()}
                </div>
                <div>
                    <p className="text-sm font-medium">{alert.title}</p>
                    <p className="text-xs text-muted-foreground">{alert.description}</p>
                </div>
            </div>
            {alert.href && (
                <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
        </motion.div>
    )

    if (alert.href) {
        return <Link href={alert.href}>{content}</Link>
    }

    return content
}
