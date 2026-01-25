'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, AlertTriangle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'

interface OverdueTask {
    id: string
    title: string
    due_date: string
    client_id: string
    clients: {
        id: string
        name: string
    }
    assigned_user?: { name: string } | null
}

interface OverdueTasksWidgetProps {
    tasks: OverdueTask[]
}

export function OverdueTasksWidget({ tasks }: OverdueTasksWidgetProps) {
    if (tasks.length === 0) {
        return (
            <Card className="bg-[#1A1A1A] border-gray-800">
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-white">
                        <Clock className="h-5 w-5 text-gray-400" />
                        Overdue Onboarding Tasks
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-gray-400 text-sm">
                        No overdue tasks. Great job keeping onboarding on track!
                    </p>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="bg-[#1A1A1A] border-gray-800">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-white">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    Overdue Onboarding Tasks
                    <Badge variant="destructive" className="ml-2">
                        {tasks.length}
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-3 max-h-[300px] overflow-y-auto">
                    {tasks.map((task) => (
                        <Link
                            key={task.id}
                            href={`/clients/${task.client_id}`}
                            className="block p-3 rounded-lg border border-gray-800 bg-gray-900/50 hover:bg-gray-800/50 transition-colors"
                        >
                            <div className="flex justify-between items-start gap-2">
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-white truncate">
                                        {task.title}
                                    </p>
                                    <p className="text-sm text-gray-400 truncate">
                                        {task.clients.name}
                                    </p>
                                </div>
                                <Badge
                                    variant="outline"
                                    className="text-amber-500 border-amber-500/50 whitespace-nowrap"
                                >
                                    {formatDistanceToNow(new Date(task.due_date), { addSuffix: true })}
                                </Badge>
                            </div>
                            {task.assigned_user && (
                                <p className="text-xs text-gray-500 mt-1">
                                    Assigned to: {task.assigned_user.name}
                                </p>
                            )}
                        </Link>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}
