'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Briefcase, ArrowRight } from 'lucide-react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { QuickAction } from '@/lib/dashboard-config'
import { cn } from '@/lib/utils'

interface QuickActionsWidgetProps {
    actions: QuickAction[]
    delay?: number
}

export function QuickActionsWidget({ actions, delay = 0 }: QuickActionsWidgetProps) {
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
            <Card className="bg-card/50 backdrop-blur-sm border-primary/10">
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <Briefcase className="h-4 w-4" />
                        Quick Actions
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        {actions.map((action, index) => (
                            <motion.div
                                key={action.href}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: (delay * 0.1) + (index * 0.05) }}
                            >
                                <Link
                                    href={action.href}
                                    className="flex items-center justify-between p-3 rounded-lg border border-transparent hover:border-primary/20 hover:bg-white/5 transition-all group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            'p-2 rounded-full transition-colors',
                                            `bg-${action.iconColor.replace('text-', '')}/10`,
                                            `group-hover:bg-${action.iconColor.replace('text-', '')}/20`
                                        )}>
                                            <action.icon className={cn('h-4 w-4', action.iconColor)} />
                                        </div>
                                        <span className="text-sm font-medium group-hover:text-primary transition-colors">
                                            {action.label}
                                        </span>
                                    </div>
                                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                </Link>
                            </motion.div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    )
}
