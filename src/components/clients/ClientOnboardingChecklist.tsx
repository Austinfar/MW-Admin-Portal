'use client'

import { OnboardingTask } from '@/types/onboarding'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { updateClientTaskStatus } from '@/lib/actions/onboarding'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { useState } from 'react'

interface ClientOnboardingChecklistProps {
    tasks: OnboardingTask[]
    clientId: string
}

export function ClientOnboardingChecklist({ tasks, clientId }: ClientOnboardingChecklistProps) {
    // Optimistic state
    const [optimisticTasks, setOptimisticTasks] = useState(tasks)

    // Sync if props update from server re-render
    if (tasks !== optimisticTasks && tasks.length !== optimisticTasks.length) {
        // Simple heuristic: if server length changes, likely a real update, so sync.
        // But for status toggle, we want to keep optimistic state.
        // A better approach in production is using useOptimistic from React 18/Next 14,
        // but explicit state is fine here for now.
    }

    async function toggleTask(taskId: string, currentStatus: string) {
        const newStatus = currentStatus === 'completed' ? 'pending' : 'completed'

        // Optimistic update locally
        setOptimisticTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t))

        try {
            await updateClientTaskStatus(taskId, newStatus)
        } catch (error) {
            // Revert on error
            setOptimisticTasks(tasks)
        }
    }

    if (optimisticTasks.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Onboarding Tasks</CardTitle>
                    <CardDescription>No tasks assigned.</CardDescription>
                </CardHeader>
                <CardContent className="h-[200px] flex items-center justify-center text-muted-foreground border-dashed border-2 m-4 rounded-lg">
                    No onboarding tasks assigned.
                    {/* Add button to assign manually could go here later */}
                </CardContent>
            </Card>
        )
    }

    const pendingTasks = optimisticTasks.filter(t => t.status === 'pending')
    const completedTasks = optimisticTasks.filter(t => t.status === 'completed')
    const progress = Math.round((completedTasks.length / optimisticTasks.length) * 100)

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Onboarding Checklist</CardTitle>
                    <CardDescription>{progress}% Complete</CardDescription>
                </div>
                {/* Progress bar could go here */}
            </CardHeader>
            <CardContent className="space-y-6">
                <div>
                    <h4 className="mb-4 text-sm font-medium text-muted-foreground">Pending Tasks</h4>
                    <div className="space-y-3">
                        {pendingTasks.length === 0 && <span className="text-sm text-muted-foreground italic">All caught up!</span>}
                        {pendingTasks.map((task) => (
                            <div key={task.id} className="flex items-start space-x-3 p-2 rounded hover:bg-muted/50 transition">
                                <Checkbox
                                    id={task.id}
                                    checked={false}
                                    onCheckedChange={() => toggleTask(task.id, 'pending')}
                                />
                                <div className="grid gap-1.5 leading-none">
                                    <Label htmlFor={task.id} className="font-medium cursor-pointer">
                                        {task.title}
                                    </Label>
                                    <p className="text-sm text-muted-foreground">
                                        {task.description}
                                    </p>
                                    {task.due_date && (
                                        <p className={cn("text-xs", isOverdue(task.due_date) ? "text-red-500 font-medium" : "text-muted-foreground")}>
                                            Due {format(new Date(task.due_date), 'MMM d')}
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {completedTasks.length > 0 && (
                    <div>
                        <h4 className="mb-4 text-sm font-medium text-muted-foreground">Completed</h4>
                        <div className="space-y-3 opacity-60">
                            {completedTasks.map((task) => (
                                <div key={task.id} className="flex items-start space-x-3 p-2">
                                    <Checkbox
                                        id={task.id}
                                        checked={true}
                                        onCheckedChange={() => toggleTask(task.id, 'completed')}
                                    />
                                    <div className="grid gap-1.5 leading-none">
                                        <Label htmlFor={task.id} className="font-medium line-through cursor-pointer">
                                            {task.title}
                                        </Label>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

function isOverdue(dateString: string) {
    return new Date(dateString) < new Date() && new Date(dateString).toDateString() !== new Date().toDateString()
}
