'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { saveTemplateTask } from '@/lib/actions/onboarding'
import { Plus } from 'lucide-react'
import { OnboardingTaskTemplate } from '@/types/onboarding'

interface TemplateTaskDialogProps {
    templateId: string
    task?: OnboardingTaskTemplate
    trigger?: React.ReactNode
}

export function TemplateTaskDialog({ templateId, task, trigger }: TemplateTaskDialogProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [isRequired, setIsRequired] = useState(task?.is_required ?? true)

    async function handleSubmit(formData: FormData) {
        setLoading(true)

        const taskData = {
            id: task?.id,
            title: formData.get('title') as string,
            description: formData.get('description') as string,
            due_offset_days: parseInt(formData.get('due_offset_days') as string) || 0,
            is_required: isRequired,
            display_order: parseInt(formData.get('display_order') as string) || 0
        }

        const result = await saveTemplateTask(templateId, taskData)
        setLoading(false)

        if (result.error) {
            alert(result.error)
        } else {
            setOpen(false)
        }
    }

    const isEdit = !!task

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button size="sm">
                        <Plus className="mr-2 h-4 w-4" />
                        Add Task
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{isEdit ? 'Edit Task' : 'Add Task'}</DialogTitle>
                    <DialogDescription>
                        Configuration for this onboarding step.
                    </DialogDescription>
                </DialogHeader>
                <form action={handleSubmit}>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="title" className="text-right">
                                Title
                            </Label>
                            <Input
                                id="title"
                                name="title"
                                defaultValue={task?.title}
                                className="col-span-3"
                                required
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="description" className="text-right">
                                Description
                            </Label>
                            <Textarea
                                id="description"
                                name="description"
                                defaultValue={task?.description || ''}
                                className="col-span-3"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="due_offset_days" className="text-right">
                                Due Day
                            </Label>
                            <div className="col-span-3 flex items-center gap-2">
                                <Input
                                    id="due_offset_days"
                                    name="due_offset_days"
                                    type="number"
                                    defaultValue={task?.due_offset_days || 0}
                                    className="w-24"
                                />
                                <span className="text-muted-foreground text-sm">days after start</span>
                            </div>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="is_required" className="text-right">
                                Required
                            </Label>
                            <div className="col-span-3 flex items-center space-x-2">
                                <Checkbox
                                    id="is_required"
                                    checked={isRequired}
                                    onCheckedChange={(checked) => setIsRequired(checked as boolean)}
                                />
                                <label htmlFor="is_required" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                    Client must complete this
                                </label>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={loading}>
                            {loading ? 'Saving...' : 'Save Task'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
