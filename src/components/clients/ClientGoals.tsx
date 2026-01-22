'use client'

import { useState, useTransition } from 'react'
import { Plus, Target, Trophy, X, MoreHorizontal, Pencil, Trash2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { ClientGoal, GoalType, GoalStatus } from '@/types/client'
import { createGoal, updateGoal, deleteGoal, achieveGoal, abandonGoal, reactivateGoal, updateGoalProgress } from '@/lib/actions/goals'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

interface ClientGoalsProps {
    clientId: string
    goals: ClientGoal[]
}

const GOAL_TYPE_LABELS: Record<GoalType, string> = {
    outcome: 'Outcome',
    habit: 'Habit',
    milestone: 'Milestone',
}

const STATUS_STYLES: Record<GoalStatus, { badge: string; label: string }> = {
    active: { badge: 'bg-blue-500/15 text-blue-500', label: 'Active' },
    achieved: { badge: 'bg-emerald-500/15 text-emerald-500', label: 'Achieved' },
    abandoned: { badge: 'bg-gray-500/15 text-gray-500', label: 'Abandoned' },
}

export function ClientGoals({ clientId, goals }: ClientGoalsProps) {
    const [isAddOpen, setIsAddOpen] = useState(false)
    const [editingGoal, setEditingGoal] = useState<ClientGoal | null>(null)
    const [isPending, startTransition] = useTransition()

    const activeGoals = goals.filter(g => g.status === 'active')
    const achievedGoals = goals.filter(g => g.status === 'achieved')
    const abandonedGoals = goals.filter(g => g.status === 'abandoned')

    const handleAchieve = (goalId: string) => {
        startTransition(async () => {
            const result = await achieveGoal(goalId)
            if (result.error) {
                toast.error('Failed to mark goal as achieved')
            } else {
                toast.success('Goal achieved!')
            }
        })
    }

    const handleAbandon = (goalId: string) => {
        startTransition(async () => {
            const result = await abandonGoal(goalId)
            if (result.error) {
                toast.error('Failed to abandon goal')
            } else {
                toast.success('Goal abandoned')
            }
        })
    }

    const handleReactivate = (goalId: string) => {
        startTransition(async () => {
            const result = await reactivateGoal(goalId)
            if (result.error) {
                toast.error('Failed to reactivate goal')
            } else {
                toast.success('Goal reactivated')
            }
        })
    }

    const handleDelete = (goalId: string) => {
        startTransition(async () => {
            const result = await deleteGoal(goalId)
            if (result.error) {
                toast.error('Failed to delete goal')
            } else {
                toast.success('Goal deleted')
            }
        })
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    Goals & Milestones
                </CardTitle>
                <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                    <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8">
                            <Plus className="h-4 w-4 mr-1" />
                            Add
                        </Button>
                    </DialogTrigger>
                    <GoalDialog
                        clientId={clientId}
                        onClose={() => setIsAddOpen(false)}
                    />
                </Dialog>
            </CardHeader>
            <CardContent className="space-y-3">
                {goals.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                        <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No goals set yet</p>
                        <p className="text-xs">Add goals to track client progress</p>
                    </div>
                ) : (
                    <>
                        {/* Active Goals */}
                        {activeGoals.length > 0 && (
                            <div className="space-y-2">
                                {activeGoals.map((goal) => (
                                    <GoalItem
                                        key={goal.id}
                                        goal={goal}
                                        onAchieve={() => handleAchieve(goal.id)}
                                        onAbandon={() => handleAbandon(goal.id)}
                                        onEdit={() => setEditingGoal(goal)}
                                        onDelete={() => handleDelete(goal.id)}
                                        disabled={isPending}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Achieved Goals */}
                        {achievedGoals.length > 0 && (
                            <div className="space-y-2">
                                <p className="text-xs text-muted-foreground font-medium pt-2">Achieved</p>
                                {achievedGoals.map((goal) => (
                                    <GoalItem
                                        key={goal.id}
                                        goal={goal}
                                        onReactivate={() => handleReactivate(goal.id)}
                                        onDelete={() => handleDelete(goal.id)}
                                        disabled={isPending}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Abandoned Goals (collapsed) */}
                        {abandonedGoals.length > 0 && (
                            <details className="text-xs">
                                <summary className="text-muted-foreground cursor-pointer hover:text-foreground">
                                    {abandonedGoals.length} abandoned goal{abandonedGoals.length > 1 ? 's' : ''}
                                </summary>
                                <div className="space-y-2 mt-2">
                                    {abandonedGoals.map((goal) => (
                                        <GoalItem
                                            key={goal.id}
                                            goal={goal}
                                            onReactivate={() => handleReactivate(goal.id)}
                                            onDelete={() => handleDelete(goal.id)}
                                            disabled={isPending}
                                        />
                                    ))}
                                </div>
                            </details>
                        )}
                    </>
                )}

                {/* Edit Dialog */}
                {editingGoal && (
                    <Dialog open={!!editingGoal} onOpenChange={() => setEditingGoal(null)}>
                        <GoalDialog
                            clientId={clientId}
                            goal={editingGoal}
                            onClose={() => setEditingGoal(null)}
                        />
                    </Dialog>
                )}
            </CardContent>
        </Card>
    )
}

interface GoalItemProps {
    goal: ClientGoal
    onAchieve?: () => void
    onAbandon?: () => void
    onReactivate?: () => void
    onEdit?: () => void
    onDelete: () => void
    disabled?: boolean
}

function GoalItem({ goal, onAchieve, onAbandon, onReactivate, onEdit, onDelete, disabled }: GoalItemProps) {
    const progress = goal.target_value
        ? Math.min(100, Math.round((goal.current_value / goal.target_value) * 100))
        : null

    const statusStyle = STATUS_STYLES[goal.status]

    return (
        <div className={cn(
            'p-3 rounded-lg border bg-card/50 space-y-2',
            goal.status === 'abandoned' && 'opacity-60'
        )}>
            <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        {goal.status === 'achieved' && (
                            <Trophy className="h-4 w-4 text-amber-500 shrink-0" />
                        )}
                        <span className={cn(
                            'font-medium text-sm',
                            goal.status === 'achieved' && 'line-through text-muted-foreground'
                        )}>
                            {goal.title}
                        </span>
                    </div>
                    {goal.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {goal.description}
                        </p>
                    )}
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6" disabled={disabled}>
                            <MoreHorizontal className="h-3 w-3" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {goal.status === 'active' && (
                            <>
                                <DropdownMenuItem onClick={onAchieve}>
                                    <Trophy className="h-4 w-4 mr-2" />
                                    Mark Achieved
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={onEdit}>
                                    <Pencil className="h-4 w-4 mr-2" />
                                    Edit
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={onAbandon} className="text-muted-foreground">
                                    <X className="h-4 w-4 mr-2" />
                                    Abandon
                                </DropdownMenuItem>
                            </>
                        )}
                        {(goal.status === 'achieved' || goal.status === 'abandoned') && (
                            <DropdownMenuItem onClick={onReactivate}>
                                <RotateCcw className="h-4 w-4 mr-2" />
                                Reactivate
                            </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={onDelete} className="text-red-600">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <div className="flex items-center gap-2 text-xs">
                <Badge variant="secondary" className={cn('text-[10px]', statusStyle.badge)}>
                    {statusStyle.label}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                    {GOAL_TYPE_LABELS[goal.goal_type]}
                </Badge>
                {goal.target_date && (
                    <span className="text-muted-foreground">
                        Due {format(new Date(goal.target_date), 'MMM d')}
                    </span>
                )}
            </div>

            {/* Progress bar for quantitative goals */}
            {progress !== null && goal.status === 'active' && (
                <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-medium">
                            {goal.current_value} / {goal.target_value} {goal.target_unit}
                        </span>
                    </div>
                    <Progress value={progress} className="h-1.5" />
                </div>
            )}

            {goal.achieved_at && (
                <p className="text-xs text-muted-foreground">
                    Achieved on {format(new Date(goal.achieved_at), 'MMM d, yyyy')}
                </p>
            )}
        </div>
    )
}

interface GoalDialogProps {
    clientId: string
    goal?: ClientGoal
    onClose: () => void
}

function GoalDialog({ clientId, goal, onClose }: GoalDialogProps) {
    const [isPending, startTransition] = useTransition()
    const [formData, setFormData] = useState({
        title: goal?.title || '',
        description: goal?.description || '',
        goal_type: goal?.goal_type || 'outcome' as GoalType,
        target_value: goal?.target_value?.toString() || '',
        target_unit: goal?.target_unit || '',
        current_value: goal?.current_value?.toString() || '0',
        target_date: goal?.target_date || '',
    })

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()

        startTransition(async () => {
            const data = {
                title: formData.title,
                description: formData.description || undefined,
                goal_type: formData.goal_type,
                target_value: formData.target_value ? parseFloat(formData.target_value) : undefined,
                target_unit: formData.target_unit || undefined,
                target_date: formData.target_date || undefined,
            }

            let result
            if (goal) {
                result = await updateGoal(goal.id, {
                    ...data,
                    current_value: formData.current_value ? parseFloat(formData.current_value) : 0,
                })
            } else {
                result = await createGoal(clientId, data)
            }

            if (result.error) {
                toast.error(goal ? 'Failed to update goal' : 'Failed to create goal')
            } else {
                toast.success(goal ? 'Goal updated' : 'Goal created')
                onClose()
            }
        })
    }

    return (
        <DialogContent>
            <DialogHeader>
                <DialogTitle>{goal ? 'Edit Goal' : 'Add Goal'}</DialogTitle>
                <DialogDescription>
                    {goal ? 'Update the goal details' : 'Set a new goal for this client'}
                </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="title">Title</Label>
                        <Input
                            id="title"
                            value={formData.title}
                            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                            placeholder="e.g., Lose 10 pounds"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Description (optional)</Label>
                        <Textarea
                            id="description"
                            value={formData.description}
                            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Additional details about this goal..."
                            rows={2}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="goal_type">Type</Label>
                            <Select
                                value={formData.goal_type}
                                onValueChange={(value: GoalType) => setFormData(prev => ({ ...prev, goal_type: value }))}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="outcome">Outcome</SelectItem>
                                    <SelectItem value="habit">Habit</SelectItem>
                                    <SelectItem value="milestone">Milestone</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="target_date">Target Date (optional)</Label>
                            <Input
                                id="target_date"
                                type="date"
                                value={formData.target_date}
                                onChange={(e) => setFormData(prev => ({ ...prev, target_date: e.target.value }))}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="target_value">Target Value</Label>
                            <Input
                                id="target_value"
                                type="number"
                                step="any"
                                value={formData.target_value}
                                onChange={(e) => setFormData(prev => ({ ...prev, target_value: e.target.value }))}
                                placeholder="e.g., 10"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="target_unit">Unit</Label>
                            <Input
                                id="target_unit"
                                value={formData.target_unit}
                                onChange={(e) => setFormData(prev => ({ ...prev, target_unit: e.target.value }))}
                                placeholder="e.g., lbs"
                            />
                        </div>

                        {goal && (
                            <div className="space-y-2">
                                <Label htmlFor="current_value">Current</Label>
                                <Input
                                    id="current_value"
                                    type="number"
                                    step="any"
                                    value={formData.current_value}
                                    onChange={(e) => setFormData(prev => ({ ...prev, current_value: e.target.value }))}
                                />
                            </div>
                        )}
                    </div>
                </div>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={isPending}>
                        {isPending ? 'Saving...' : goal ? 'Update' : 'Create'}
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
    )
}
