'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowRight, type LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface WidgetCardProps {
    title: string
    subtitle?: string
    icon?: LucideIcon
    iconColor?: string
    action?: {
        label: string
        href: string
    }
    children: React.ReactNode
    className?: string
    // Animation delay for staggered entrance
    delay?: number
    // Optional gradient background
    gradient?: boolean
}

export function WidgetCard({
    title,
    subtitle,
    icon: Icon,
    iconColor = 'text-primary',
    action,
    children,
    className,
    delay = 0,
    gradient = false
}: WidgetCardProps) {
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
            <Card
                className={cn(
                    'bg-card/50 backdrop-blur-sm border-primary/10 hover:border-primary/30 transition-all duration-300',
                    gradient && 'bg-gradient-to-br from-primary/20 to-secondary border-primary/20',
                    className
                )}
            >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div className="flex items-center gap-2">
                        {Icon && (
                            <div className={cn('p-2 rounded-full', `bg-${iconColor.replace('text-', '')}/10`)}>
                                <Icon className={cn('h-4 w-4', iconColor)} />
                            </div>
                        )}
                        <div>
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                {title}
                            </CardTitle>
                            {subtitle && (
                                <p className="text-xs text-muted-foreground/70 mt-0.5">
                                    {subtitle}
                                </p>
                            )}
                        </div>
                    </div>
                    {action && (
                        <Button
                            variant="ghost"
                            size="sm"
                            asChild
                            className="h-8 text-xs text-muted-foreground hover:text-primary"
                        >
                            <Link href={action.href}>
                                {action.label}
                                <ArrowRight className="h-3 w-3 ml-1" />
                            </Link>
                        </Button>
                    )}
                </CardHeader>
                <CardContent>
                    {children}
                </CardContent>
            </Card>
        </motion.div>
    )
}

// Simplified metric card variant
interface MetricWidgetProps {
    title: string
    value: string | number
    subtitle?: string
    icon?: LucideIcon
    iconColor?: string
    trend?: {
        value: string
        direction: 'up' | 'down' | 'neutral'
    }
    progress?: number // 0-100
    delay?: number
    className?: string
    gradient?: boolean
}

export function MetricWidget({
    title,
    value,
    subtitle,
    icon: Icon,
    iconColor = 'text-primary',
    trend,
    progress,
    delay = 0,
    className,
    gradient = false
}: MetricWidgetProps) {
    const getTrendColor = (direction: 'up' | 'down' | 'neutral') => {
        switch (direction) {
            case 'up':
                return 'text-green-400 bg-green-500/10'
            case 'down':
                return 'text-red-400 bg-red-500/10'
            default:
                return 'text-muted-foreground bg-muted'
        }
    }

    const bgColorClass = iconColor.replace('text-', 'bg-').replace('-500', '-500/10')

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
            <Card
                className={cn(
                    'bg-card/50 backdrop-blur-sm border-primary/10 hover:border-primary/30 transition-all duration-300',
                    gradient && 'bg-gradient-to-br from-primary/20 to-secondary border-primary/20',
                    className
                )}
            >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                        {title}
                    </CardTitle>
                    {Icon && (
                        <div className={cn('p-2 rounded-full', bgColorClass)}>
                            <Icon className={cn('h-4 w-4', iconColor)} />
                        </div>
                    )}
                </CardHeader>
                <CardContent>
                    <div className="flex items-baseline justify-between">
                        <div className="text-3xl font-bold tracking-tight">{value}</div>
                        {trend && (
                            <div className={cn(
                                'flex items-center text-xs px-2 py-0.5 rounded-full font-medium',
                                getTrendColor(trend.direction)
                            )}>
                                {trend.direction === 'up' && '+'}{trend.value}
                            </div>
                        )}
                    </div>
                    {subtitle && (
                        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
                    )}
                    {progress !== undefined && (
                        <div className="mt-4 h-1 w-full bg-secondary rounded-full overflow-hidden">
                            <motion.div
                                className={cn('h-full', iconColor.replace('text-', 'bg-'))}
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                                transition={{ duration: 0.8, delay: delay * 0.1 + 0.2 }}
                            />
                        </div>
                    )}
                </CardContent>
            </Card>
        </motion.div>
    )
}
