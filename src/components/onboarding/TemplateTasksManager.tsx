'use client'

import { OnboardingTaskTemplate } from '@/types/onboarding'
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, GripVertical, Trash2, Edit2, Calendar } from 'lucide-react'
import { TemplateTaskDialog } from './TemplateTaskDialog'
import { deleteTemplateTask } from '@/lib/actions/onboarding'
import { Badge } from '@/components/ui/badge'

interface TemplateTasksManagerProps {
    templateId: string
    initialTasks: OnboardingTaskTemplate[]
}

export function TemplateTasksManager({ templateId, initialTasks }: TemplateTasksManagerProps) {
    const [tasks, setTasks] = useState(initialTasks)

    // Optimistic updates could be done here, but staying simple for now relying on server action revalidate.
    // Actually, revalidatePath in action will refresh the server component, but client state might need manual refresh or router.refresh() 
    // if unrelated to `initialTasks` prop update (which happens on navigation/refresh).
    // For now, let's assume page refresh on mutation or use router.refresh().

    async function handleDelete(id: string) {
        if (!confirm('Delete this task?')) return
        await deleteTemplateTask(id)
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Tasks ({initialTasks.length})</h3>
                <TemplateTaskDialog templateId={templateId} />
            </div>

            <div className="space-y-2">
                {initialTasks.length === 0 && (
                    <Card className="bg-muted/50 border-dashed">
                        <CardContent className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                            <p>No tasks yet.</p>
                            <p className="text-sm">Add your first task to get started.</p>
                        </CardContent>
                    </Card>
                )}

                {initialTasks.map((task) => (
                    <Card key={task.id} className="relative group hover:border-primary/50 transition-colors">
                        <CardContent className="p-4 flex items-start gap-4">
                            <div className="mt-1 cursor-grab active:cursor-grabbing text-muted-foreground">
                                <GripVertical className="h-5 w-5" />
                            </div>
                            <div className="flex-1 space-y-1">
                                <div className="flex items-center gap-2">
                                    <h4 className="font-semibold">{task.title}</h4>
                                    {task.is_required && <Badge variant="secondary" className="text-xs">Required</Badge>}
                                </div>
                                {task.description && (
                                    <p className="text-sm text-muted-foreground">{task.description}</p>
                                )}
                                <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                                    <div className="flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        Due: Day {task.due_offset_days}
                                    </div>
                                    {/* Additional metadata can go here */}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <TemplateTaskDialog templateId={templateId} task={task} trigger={
                                    <Button variant="ghost" size="icon">
                                        <Edit2 className="h-4 w-4" />
                                    </Button>
                                } />
                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDelete(task.id)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    )
}
