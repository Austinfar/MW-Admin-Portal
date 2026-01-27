'use client'

import { OnboardingTask } from '@/types/onboarding'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { updateClientTaskStatus, updateClientTask } from '@/lib/actions/onboarding'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import { Plus, Loader2, Pencil, Calendar, User } from 'lucide-react'
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
        const result = await createAdHocTask(clientId, newTaskTitle)
        setIsAddingTask(false)

        if (result.error) {
            toast.error(result.error)
        } else {
            toast.success('Task added')
            setNewTaskTitle('')
            setIsAddTaskOpen(false)
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

    if (optimisticTasks.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Onboarding Tasks</CardTitle>
                    <CardDescription>No tasks assigned.</CardDescription>
                </CardHeader>
                <CardContent className="h-[200px] flex flex-col items-center justify-center text-muted-foreground border-dashed border-2 m-4 rounded-lg gap-4">
                    <span>No onboarding tasks assigned.</span>
                    <Button variant="outline" size="sm" onClick={() => setIsAddTaskOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" /> Add Task
                    </Button>
                </CardContent>
                <AddTaskDialog
                    isOpen={isAddTaskOpen}
                    onOpenChange={setIsAddTaskOpen}
                    onSubmit={handleAddTask}
                    isAdding={isAddingTask}
                    title={newTaskTitle}
                    onTitleChange={setNewTaskTitle}
                />
            </Card>
        )
    }

    // Sort tasks by due date (soonest to latest), then by title
    const sortedTasks = [...optimisticTasks].sort((a, b) => {
        const dateA = new Date(a.due_date || '9999-12-31').getTime()
        const dateB = new Date(b.due_date || '9999-12-31').getTime()
        if (dateA !== dateB) return dateA - dateB
        return a.title.localeCompare(b.title)
    })

    const pendingTasks = sortedTasks.filter(t => t.status === 'pending')
    const completedTasks = sortedTasks.filter(t => t.status === 'completed')
    const progress = optimisticTasks.length > 0 ? Math.round((completedTasks.length / optimisticTasks.length) * 100) : 0

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Onboarding Checklist</CardTitle>
                    <CardDescription>{progress}% Complete</CardDescription>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                <div>
                    <h4 className="mb-4 text-sm font-medium text-muted-foreground">Pending Tasks</h4>
                    <div className="space-y-3">
                        {pendingTasks.length === 0 && <span className="text-sm text-muted-foreground italic">All caught up!</span>}
                        {pendingTasks.map((task) => (
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
                                    <div className="grid gap-1.5 leading-none flex-1">
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
            <div className="p-6 pt-0">
                <Dialog open={isAddTaskOpen} onOpenChange={setIsAddTaskOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="w-full">
                            <Plus className="h-4 w-4 mr-2" /> Add Custom Task
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add Custom Task</DialogTitle>
                            <DialogDescription>Add a one-off task for this client.</DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleAddTask}>
                            <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="taskTitle">Task Title</Label>
                                    <Input
                                        id="taskTitle"
                                        value={newTaskTitle}
                                        onChange={(e) => setNewTaskTitle(e.target.value)}
                                        placeholder="e.g. Schedule kick-off call"
                                        autoFocus
                                    />
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
        </Card>
    )
}

function TaskRow({ task, onToggle, onEdit, users }: {
    task: OnboardingTask
    onToggle: (id: string, status: string) => void
    onEdit: (task: OnboardingTask) => void
    users: User[]
}) {
    const assignedUser = users.find(u => u.id === (task as any).assigned_user_id)

    return (
        <div className="flex items-start space-x-3 p-2 rounded hover:bg-muted/50 transition group">
            <Checkbox
                id={task.id}
                checked={false}
                onCheckedChange={() => onToggle(task.id, 'pending')}
            />
            <div className="grid gap-1.5 leading-none flex-1">
                <Label htmlFor={task.id} className="font-medium cursor-pointer">
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
                            isOverdue(task.due_date) && "text-red-500 font-medium"
                        )}>
                            <Calendar className="h-3 w-3" />
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

function AddTaskDialog({ isOpen, onOpenChange, onSubmit, isAdding, title, onTitleChange }: {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    onSubmit: (e: React.FormEvent) => void
    isAdding: boolean
    title: string
    onTitleChange: (val: string) => void
}) {
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add Custom Task</DialogTitle>
                    <DialogDescription>Add a one-off task for this client.</DialogDescription>
                </DialogHeader>
                <form onSubmit={onSubmit}>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="emptyTaskTitle">Task Title</Label>
                            <Input
                                id="emptyTaskTitle"
                                value={title}
                                onChange={(e) => onTitleChange(e.target.value)}
                                placeholder="e.g. Schedule kick-off call"
                                autoFocus
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={isAdding}>
                            {isAdding && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Add Task
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

function isOverdue(dateString: string) {
    return new Date(dateString) < new Date() && new Date(dateString).toDateString() !== new Date().toDateString()
}
