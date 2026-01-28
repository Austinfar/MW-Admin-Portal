'use client'

import { OnboardingTask } from '@/types/onboarding'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { updateClientTaskStatus, updateClientTask } from '@/lib/actions/onboarding'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import { Plus, Loader2, Pencil, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { createAdHocTask } from '@/lib/actions/onboarding'
import { toast } from 'sonner'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Calendar as CalendarIcon } from 'lucide-react'
import { Calendar } from '@/components/ui/calendar'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover'

interface User {
    id: string
    name: string
}

interface ClientOnboardingChecklistProps {
    tasks: OnboardingTask[]
    clientId: string
    users?: User[]
}

export function ClientOnboardingChecklist({ tasks, clientId, users = [] }: ClientOnboardingChecklistProps) {
    const [optimisticTasks, setOptimisticTasks] = useState(tasks)
    const [isAddTaskOpen, setIsAddTaskOpen] = useState(false)
    const [isAddingTask, setIsAddingTask] = useState(false)
    const [newTaskTitle, setNewTaskTitle] = useState('')
    const [newTaskDescription, setNewTaskDescription] = useState('')
    const [newTaskDueDate, setNewTaskDueDate] = useState('')
    const [newTaskAssignee, setNewTaskAssignee] = useState<string | null>(null)

    // Sync state with props if they change (server revalidation)
    // using a key or simple effect
    const [prevTasks, setPrevTasks] = useState(tasks)
    if (tasks !== prevTasks) {
        setPrevTasks(tasks)
        setOptimisticTasks(tasks)
    }

    // Edit state
    const [editingTask, setEditingTask] = useState<OnboardingTask | null>(null)
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
    const [isSavingEdit, setIsSavingEdit] = useState(false)

    async function handleAddTask(e: React.FormEvent) {
        e.preventDefault()
        if (!newTaskTitle.trim()) return

        setIsAddingTask(true)
        const result = await createAdHocTask(
            clientId,
            newTaskTitle,
            newTaskDueDate || undefined,
            newTaskDescription || undefined,
            newTaskAssignee
        )
        setIsAddingTask(false)

        if (result.error) {
            toast.error(result.error)
        } else {
            toast.success('Task added')
            setNewTaskTitle('')
            setNewTaskDescription('')
            setNewTaskDueDate('')
            setNewTaskAssignee(null)
            setIsAddTaskOpen(false)

            // Optimistic update
            const newTask: OnboardingTask = {
                id: `temp-${Date.now()}`,
                client_id: clientId,
                task_template_id: null,
                title: newTaskTitle,
                description: newTaskDescription || null,
                status: 'pending',
                due_date: newTaskDueDate || new Date().toISOString(),
                assigned_user_id: newTaskAssignee,
                created_at: new Date().toISOString(),
                completed_at: null
            }
            setOptimisticTasks(prev => [...prev, newTask])
        }
    }

    async function toggleTask(taskId: string, currentStatus: string) {
        const newStatus = currentStatus === 'completed' ? 'pending' : 'completed'
        setOptimisticTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t))

        try {
            await updateClientTaskStatus(taskId, newStatus)
        } catch (error) {
            setOptimisticTasks(tasks)
        }
    }

    function openEditDialog(task: OnboardingTask) {
        setEditingTask({ ...task })
        setIsEditDialogOpen(true)
    }

    async function handleSaveEdit() {
        if (!editingTask) return

        setIsSavingEdit(true)
        const result = await updateClientTask(editingTask.id, {
            title: editingTask.title,
            description: editingTask.description || undefined,
            due_date: editingTask.due_date || undefined,
            assigned_user_id: (editingTask as any).assigned_user_id || null,
        })
        setIsSavingEdit(false)

        if (result.error) {
            toast.error(result.error)
        } else {
            toast.success('Task updated')
            setOptimisticTasks(prev => prev.map(t => t.id === editingTask.id ? editingTask : t))
            setIsEditDialogOpen(false)
            setEditingTask(null)
        }
    }

    // Sort tasks: Due date soonest -> No due date (last) -> Title
    const sortedTasks = [...optimisticTasks].sort((a, b) => {
        const dateA = new Date(a.due_date || '9999-12-31').getTime()
        const dateB = new Date(b.due_date || '9999-12-31').getTime()
        if (dateA !== dateB) return dateA - dateB
        return a.title.localeCompare(b.title)
    })

    // Split tasks
    const templateTasks = sortedTasks.filter(t => t.task_template_id)
    const adHocTasks = sortedTasks.filter(t => !t.task_template_id)

    // Onboarding progress
    const onboardingPending = templateTasks.filter(t => t.status === 'pending')
    const onboardingCompleted = templateTasks.filter(t => t.status === 'completed')
    const onboardingProgress = templateTasks.length > 0 ? Math.round((onboardingCompleted.length / templateTasks.length) * 100) : 0
    const isOnboardingComplete = templateTasks.length > 0 && onboardingPending.length === 0

    // Auto-collapse logic: default to collapsed if complete, expanded otherwise. Allow manual toggle.
    const [isOnboardingExpanded, setIsOnboardingExpanded] = useState(!isOnboardingComplete)

    // Update expanded state if completion status changes (optional, but good for UX)
    // useEffect(() => {
    //     if (isOnboardingComplete) setIsOnboardingExpanded(false)
    // }, [isOnboardingComplete]) 
    // Commented out to avoid annoying auto-collapse while user is interacting. Initial state is enough.

    return (
        <div className="space-y-6">
            {/* Onboarding Card */}
            {templateTasks.length > 0 && (
                <Card>
                    <CardHeader
                        className="flex flex-row items-center justify-between cursor-pointer hover:bg-muted/5 transition-colors"
                        onClick={() => setIsOnboardingExpanded(!isOnboardingExpanded)}
                    >
                        <div className="space-y-1.5">
                            <CardTitle className="flex items-center gap-2">
                                Onboarding Checklist
                                {isOnboardingComplete && <span className="text-xs bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full font-medium">Complete</span>}
                            </CardTitle>
                            <CardDescription>{onboardingProgress}% Complete</CardDescription>
                        </div>
                        <div className="text-muted-foreground">
                            {isOnboardingExpanded ? (
                                <Button variant="ghost" size="sm">Hide</Button>
                            ) : (
                                <Button variant="ghost" size="sm">Show</Button>
                            )}
                        </div>
                    </CardHeader>

                    {isOnboardingExpanded && (
                        <CardContent className="space-y-6 animate-in slide-in-from-top-2 duration-200">
                            <div>
                                <h4 className="mb-4 text-sm font-medium text-muted-foreground">Pending Step</h4>
                                <div className="space-y-3">
                                    {onboardingPending.length === 0 && <span className="text-sm text-muted-foreground italic">All onboarding steps complete!</span>}
                                    {onboardingPending.map((task) => (
                                        <TaskRow
                                            key={task.id}
                                            task={task}
                                            onToggle={toggleTask}
                                            onEdit={openEditDialog}
                                            users={users}
                                        />
                                    ))}
                                </div>
                            </div>

                            {onboardingCompleted.length > 0 && (
                                <div>
                                    <h4 className="mb-4 text-sm font-medium text-muted-foreground">Completed</h4>
                                    <div className="space-y-3 opacity-60">
                                        {onboardingCompleted.map((task) => (
                                            <CompletedTaskRow key={task.id} task={task} onToggle={toggleTask} />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    )}
                </Card>
            )}

            {/* General Tasks Card */}
            <Card>
                <CardHeader>
                    <CardTitle>General Tasks</CardTitle>
                    <CardDescription>Ad-hoc tasks and daily to-dos</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-3">
                        {adHocTasks.length === 0 && <div className="text-sm text-muted-foreground italic py-4 text-center border-dashed border rounded-md">No general tasks.</div>}
                        {adHocTasks.map((task) => (
                            <TaskRow
                                key={task.id}
                                task={task}
                                onToggle={toggleTask}
                                onEdit={openEditDialog}
                                users={users}
                            />
                        ))}
                    </div>
                </CardContent>
                <div className="p-6 pt-0">
                    <Dialog open={isAddTaskOpen} onOpenChange={setIsAddTaskOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="w-full">
                                <Plus className="h-4 w-4 mr-2" /> Add Task
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Add Task</DialogTitle>
                                <DialogDescription>Create a new task for this client.</DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleAddTask}>
                                <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="taskTitle">Task Title</Label>
                                        <Input
                                            id="taskTitle"
                                            value={newTaskTitle}
                                            onChange={(e) => setNewTaskTitle(e.target.value)}
                                            placeholder="e.g. Schedule kick-off call"
                                            autoFocus
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="taskDescription">Description</Label>
                                        <Textarea
                                            id="taskDescription"
                                            value={newTaskDescription}
                                            onChange={(e) => setNewTaskDescription(e.target.value)}
                                            placeholder="Optional details..."
                                            className="h-20"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2 flex flex-col">
                                            <Label>Due Date</Label>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        variant={"outline"}
                                                        className={cn(
                                                            "w-full justify-start text-left font-normal",
                                                            !newTaskDueDate && "text-muted-foreground"
                                                        )}
                                                    >
                                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                                        {newTaskDueDate ? format(new Date(newTaskDueDate), "PPP") : <span>Pick a date</span>}
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0 bg-popover border shadow-md" align="start">
                                                    <Calendar
                                                        mode="single"
                                                        selected={newTaskDueDate ? new Date(newTaskDueDate) : undefined}
                                                        onSelect={(date) => setNewTaskDueDate(date ? date.toISOString() : '')}
                                                        initialFocus
                                                    />
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="taskAssignee">Assign To</Label>
                                            <Select
                                                value={newTaskAssignee || 'unassigned'}
                                                onValueChange={(val) => setNewTaskAssignee(val === 'unassigned' ? null : val)}
                                            >
                                                <SelectTrigger id="taskAssignee">
                                                    <SelectValue placeholder="Select user" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="unassigned">Unassigned</SelectItem>
                                                    {users.map((user) => (
                                                        <SelectItem key={user.id} value={user.id}>
                                                            {user.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button type="submit" disabled={isAddingTask}>
                                        {isAddingTask && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                        Add Task
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
            </Card>

            {/* Edit Task Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Task</DialogTitle>
                        <DialogDescription>Update task details and assignment.</DialogDescription>
                    </DialogHeader>
                    {editingTask && (
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="editTitle">Title</Label>
                                <Input
                                    id="editTitle"
                                    value={editingTask.title}
                                    onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="editDescription">Description</Label>
                                <Textarea
                                    id="editDescription"
                                    value={editingTask.description || ''}
                                    onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })}
                                    className="h-20"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="editDueDate">Due Date</Label>
                                    <Input
                                        id="editDueDate"
                                        type="date"
                                        value={editingTask.due_date ? format(new Date(editingTask.due_date), 'yyyy-MM-dd') : ''}
                                        onChange={(e) => setEditingTask({ ...editingTask, due_date: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Assigned To</Label>
                                    <Select
                                        value={(editingTask as any).assigned_user_id || 'unassigned'}
                                        onValueChange={(val) => setEditingTask({ ...editingTask, assigned_user_id: val === 'unassigned' ? null : val } as any)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select user" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="unassigned">Unassigned</SelectItem>
                                            {users.map((user) => (
                                                <SelectItem key={user.id} value={user.id}>
                                                    {user.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsEditDialogOpen(false)} disabled={isSavingEdit}>
                            Cancel
                        </Button>
                        <Button onClick={handleSaveEdit} disabled={isSavingEdit || !editingTask?.title}>
                            {isSavingEdit && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
// Helper component for completed row to reduce duplication
function CompletedTaskRow({ task, onToggle }: { task: OnboardingTask, onToggle: (id: string, status: string) => void }) {
    return (
        <div className="flex items-start space-x-3 p-2">
            <Checkbox
                id={task.id}
                checked={true}
                onCheckedChange={() => onToggle(task.id, 'completed')}
            />
            <div className="grid gap-1.5 leading-none flex-1">
                <Label htmlFor={task.id} className="font-medium line-through cursor-pointer">
                    {task.title}
                </Label>
            </div>
        </div>
    )
}

function TaskRow({ task, onToggle, onEdit, users }: {
    task: OnboardingTask
    onToggle: (id: string, status: string) => void
    onEdit: (task: OnboardingTask) => void
    users: User[]
}) {
    const assignedUser = users.find(u => u.id === (task as any).assigned_user_id)
    const isCompleted = task.status === 'completed'

    return (
        <div className={cn("flex items-start space-x-3 p-2 rounded hover:bg-muted/50 transition group", isCompleted && "opacity-60")}>
            <Checkbox
                id={task.id}
                checked={isCompleted}
                onCheckedChange={() => onToggle(task.id, task.status)}
            />
            <div className="grid gap-1.5 leading-none flex-1">
                <Label
                    htmlFor={task.id}
                    className={cn(
                        "font-medium cursor-pointer transition-all",
                        isCompleted && "line-through text-muted-foreground"
                    )}
                >
                    {task.title}
                </Label>
                {task.description && (
                    <p className="text-sm text-muted-foreground">
                        {task.description}
                    </p>
                )}
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {task.due_date && (
                        <span className={cn(
                            "flex items-center gap-1",
                            isOverdue(task.due_date) && !isCompleted && "text-red-500 font-medium"
                        )}>
                            <CalendarIcon className="h-3 w-3" />
                            {format(new Date(task.due_date), 'MMM d')}
                        </span>
                    )}
                    {assignedUser && (
                        <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {assignedUser.name}
                        </span>
                    )}
                </div>
            </div>
            <Button
                variant="ghost"
                size="icon"
                className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                onClick={() => onEdit(task)}
            >
                <Pencil className="h-4 w-4" />
            </Button>
        </div>
    )
}



function isOverdue(dateString: string) {
    return new Date(dateString) < new Date() && new Date(dateString).toDateString() !== new Date().toDateString()
}


