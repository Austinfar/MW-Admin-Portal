'use client'

import { useState, useEffect } from 'react'
import { OnboardingTaskTemplate } from '@/types/onboarding'
import { getTemplateTasks, saveTemplateTask, deleteTemplateTask } from '@/lib/actions/onboarding'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Loader2, Plus, Trash2, User, Users } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'

interface TeamUser {
    id: string
    name: string
}

interface TaskTemplateManagerProps {
    templateId: string | null
    isOpen: boolean
    onClose: () => void
    users?: TeamUser[]
}

export function TaskTemplateManager({ templateId, isOpen, onClose, users = [] }: TaskTemplateManagerProps) {
    const [tasks, setTasks] = useState<OnboardingTaskTemplate[]>([])
    const [loading, setLoading] = useState(false)
    const [editingTask, setEditingTask] = useState<Partial<OnboardingTaskTemplate> | null>(null)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (templateId && isOpen) {
            fetchTasks()
        } else {
            setTasks([])
            setEditingTask(null)
        }
    }, [templateId, isOpen])

    const fetchTasks = async () => {
        if (!templateId) return
        setLoading(true)
        const data = await getTemplateTasks(templateId)
        setTasks(data)
        setLoading(false)
    }

    const handleSaveTask = async () => {
        if (!templateId || !editingTask || !editingTask.title) return

        setSaving(true)
        const res = await saveTemplateTask(templateId, editingTask)
        setSaving(false)

        if (res.error) {
            toast.error(res.error)
        } else {
            toast.success('Task saved')
            setEditingTask(null)
            fetchTasks()
        }
    }

    const handleDeleteTask = async (taskId: string) => {
        if (!confirm('Are you sure you want to delete this task?')) return

        const res = await deleteTemplateTask(taskId)
        if (res.error) {
            toast.error(res.error)
        } else {
            toast.success('Task deleted')
            fetchTasks()
        }
    }

    // Get display name for assignment
    const getAssignmentLabel = (task: OnboardingTaskTemplate) => {
        if (task.assignment_type === 'assigned_coach') {
            return 'Assigned Coach'
        }
        if (task.assignment_type === 'specific_user' && task.default_assigned_user_id) {
            const user = users.find(u => u.id === task.default_assigned_user_id)
            return user?.name || 'Unknown User'
        }
        return 'Unassigned'
    }

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
                <SheetHeader>
                    <SheetTitle>Manage Template Tasks</SheetTitle>
                    <SheetDescription>
                        Configure the tasks that will be automatically assigned to clients.
                    </SheetDescription>
                </SheetHeader>

                <div className="mt-6 space-y-6">
                    {/* List Existing Tasks */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-medium">Tasks ({tasks.length})</h4>
                            {!editingTask && (
                                <Button size="sm" onClick={() => setEditingTask({ is_required: true, due_offset_days: 0, assignment_type: 'unassigned' })}>
                                    <Plus className="h-4 w-4 mr-1" /> Add Task
                                </Button>
                            )}
                        </div>

                        {loading ? (
                            <div className="flex justify-center py-4">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : tasks.length === 0 && !editingTask ? (
                            <p className="text-sm text-muted-foreground text-center py-8 border rounded-md border-dashed">
                                No tasks defined yet.
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {tasks.map((task) => (
                                    <div
                                        key={task.id}
                                        className={`p-3 border rounded-md flex items-center justify-between ${editingTask?.id === task.id ? 'border-primary ring-1 ring-primary' : 'hover:bg-accent/50'}`}
                                    >
                                        <div className="flex-1 mr-4">
                                            <div className="font-medium text-sm">{task.title}</div>
                                            <div className="text-xs text-muted-foreground truncate max-w-[300px]">
                                                {task.description || 'No description'}
                                            </div>
                                            <div className="text-xs text-muted-foreground mt-1 flex gap-2 flex-wrap">
                                                <span>Due: +{task.due_offset_days} days</span>
                                                {task.is_required && <span className="text-destructive font-medium">Required</span>}
                                                <span className="flex items-center gap-1">
                                                    {task.assignment_type === 'assigned_coach' ? (
                                                        <Users className="h-3 w-3" />
                                                    ) : (
                                                        <User className="h-3 w-3" />
                                                    )}
                                                    {getAssignmentLabel(task)}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => setEditingTask(task)}
                                                disabled={!!editingTask}
                                            >
                                                <span className="sr-only">Edit</span>
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-pencil"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-destructive hover:text-destructive"
                                                onClick={() => handleDeleteTask(task.id)}
                                                disabled={!!editingTask}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Edit/Create Form */}
                    {editingTask && (
                        <>
                            <Separator />
                            <div className="bg-muted/30 p-4 rounded-md space-y-4 border">
                                <h4 className="font-medium text-sm flex items-center gap-2">
                                    {editingTask.id ? 'Edit Task' : 'New Task'}
                                </h4>

                                <div className="space-y-2">
                                    <Label htmlFor="title">Task Title</Label>
                                    <Input
                                        id="title"
                                        value={editingTask.title || ''}
                                        onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                                        placeholder="e.g., Complete Intake Form"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="description">Description</Label>
                                    <Textarea
                                        id="description"
                                        value={editingTask.description || ''}
                                        onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })}
                                        placeholder="Detailed instructions for the client..."
                                        className="h-20"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="due_offset">Due In (Days)</Label>
                                        <Input
                                            id="due_offset"
                                            type="number"
                                            min="0"
                                            value={editingTask.due_offset_days?.toString() || '0'}
                                            onChange={(e) => setEditingTask({ ...editingTask, due_offset_days: parseInt(e.target.value) || 0 })}
                                        />
                                    </div>
                                    <div className="flex items-center space-x-2 pt-8">
                                        <Switch
                                            id="required"
                                            checked={editingTask.is_required}
                                            onCheckedChange={(checked) => setEditingTask({ ...editingTask, is_required: checked })}
                                        />
                                        <Label htmlFor="required">Required Task</Label>
                                    </div>
                                </div>

                                {/* Assignment Section */}
                                <div className="space-y-2">
                                    <Label>Assign To</Label>
                                    <Select
                                        value={
                                            editingTask.assignment_type === 'specific_user' && editingTask.default_assigned_user_id
                                                ? editingTask.default_assigned_user_id
                                                : editingTask.assignment_type || 'unassigned'
                                        }
                                        onValueChange={(val) => {
                                            if (val === 'unassigned') {
                                                setEditingTask({ ...editingTask, assignment_type: 'unassigned', default_assigned_user_id: null })
                                            } else if (val === 'assigned_coach') {
                                                setEditingTask({ ...editingTask, assignment_type: 'assigned_coach', default_assigned_user_id: null })
                                            } else {
                                                // It's a user ID
                                                setEditingTask({ ...editingTask, assignment_type: 'specific_user', default_assigned_user_id: val })
                                            }
                                        }}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select assignment" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="unassigned">
                                                <span className="flex items-center gap-2">
                                                    <User className="h-4 w-4 text-muted-foreground" />
                                                    Unassigned
                                                </span>
                                            </SelectItem>
                                            <SelectItem value="assigned_coach">
                                                <span className="flex items-center gap-2">
                                                    <Users className="h-4 w-4 text-primary" />
                                                    Assigned Coach (Dynamic)
                                                </span>
                                            </SelectItem>
                                            <Separator className="my-1" />
                                            {users.map((user) => (
                                                <SelectItem key={user.id} value={user.id}>
                                                    <span className="flex items-center gap-2">
                                                        <User className="h-4 w-4" />
                                                        {user.name}
                                                    </span>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        "Assigned Coach" will dynamically assign to the client's coach when tasks are created.
                                    </p>
                                </div>

                                <div className="flex justify-end gap-2 pt-2">
                                    <Button variant="ghost" onClick={() => setEditingTask(null)} disabled={saving}>
                                        Cancel
                                    </Button>
                                    <Button onClick={handleSaveTask} disabled={!editingTask.title || saving}>
                                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Save Task
                                    </Button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    )
}

