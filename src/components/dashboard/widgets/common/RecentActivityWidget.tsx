'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Activity, CreditCard, Users, UserPlus, CheckSquare } from 'lucide-react'
import { motion } from 'framer-motion'
import { ActivityItem } from '@/lib/actions/dashboard-data'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'

interface RecentActivityWidgetProps {
    activities: ActivityItem[]
    delay?: number
}

export function RecentActivityWidget({ activities, delay = 0 }: RecentActivityWidgetProps) {
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount)
    }

    const getIcon = (type: ActivityItem['type']) => {
        switch (type) {
            case 'payment':
                return CreditCard
            case 'client':
                return Users
            case 'lead':
                return UserPlus
            case 'onboarding':
                return CheckSquare
            default:
                return Activity
        }
    }

    const getIconColor = (type: ActivityItem['type'], status?: string) => {
        if (type === 'payment') {
            return status === 'succeeded' ? 'text-green-500' : 'text-red-500'
        }
        switch (type) {
            case 'client':
                return 'text-violet-500'
            case 'lead':
                return 'text-cyan-500'
            case 'onboarding':
                return 'text-pink-500'
            default:
                return 'text-blue-500'
        }
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
            <Card className="bg-card/40 border-primary/5">
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <Activity className="h-4 w-4" />
                        Recent Activity
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {activities.length === 0 ? (
                        <div className="text-sm text-muted-foreground text-center py-4">
                            No recent activity
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {activities.map((activity, index) => {
                                const Icon = getIcon(activity.type)
                                const iconColor = getIconColor(activity.type, activity.status)

                                return (
                                    <motion.div
                                        key={activity.id}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: (delay * 0.1) + (index * 0.05) }}
                                        className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={cn(
                                                'h-9 w-9 rounded-full flex items-center justify-center border border-white/5 group-hover:border-primary/30 transition-colors',
                                                activity.status === 'succeeded' ? 'bg-green-500/10' : 'bg-secondary'
                                            )}>
                                                <Icon className={cn('h-4 w-4', iconColor)} />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium leading-none group-hover:text-primary transition-colors">
                                                    {activity.title}
                                                </p>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    {activity.description}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            {activity.amount !== undefined && (
                                                <div className={cn(
                                                    'font-bold',
                                                    activity.status === 'succeeded' ? 'text-green-500' : 'text-muted-foreground'
                                                )}>
                                                    {activity.status === 'succeeded' && '+'}
                                                    {formatCurrency(activity.amount)}
                                                </div>
                                            )}
                                            <div className="text-xs text-muted-foreground">
                                                {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                                            </div>
                                        </div>
                                    </motion.div>
                                )
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </motion.div>
    )
}
