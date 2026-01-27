'use client'

import { useState } from 'react'
import { Calendar, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { createFollowUpTask } from '@/lib/actions/lead-actions'
import { toast } from 'sonner'

interface ScheduleFollowUpDialogProps {
    leadId: string
    leadName: string
    open: boolean
    onOpenChange: (open: boolean) => void
}

const TASK_TYPES = [
    { value: 'call', label: 'Call' },
    { value: 'email', label: 'Email' },
    { value: 'sms', label: 'SMS' },
    { value: 'other', label: 'Other' },
]

export function ScheduleFollowUpDialog({
    leadId,
    leadName,
    open,
    onOpenChange
}: ScheduleFollowUpDialogProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [taskType, setTaskType] = useState<'call' | 'email' | 'sms' | 'other'>('call')
    const [scheduledDate, setScheduledDate] = useState('')
    const [scheduledTime, setScheduledTime] = useState('09:00')
    const [notes, setNotes] = useState('')

    async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setIsLoading(true)

        if (!scheduledDate) {
            toast.error('Please select a date')
            setIsLoading(false)
            return
        }

        const scheduledFor = `${scheduledDate}T${scheduledTime}:00`

        const result = await createFollowUpTask(leadId, {
            taskType,
            scheduledFor,
            notes: notes || undefined
        })

        if (result?.error) {
            toast.error(result.error)
        } else {
            toast.success(`Follow-up scheduled for ${new Date(scheduledFor).toLocaleString()}`)
            onOpenChange(false)
            // Reset form
            setTaskType('call')
            setScheduledDate('')
            setScheduledTime('09:00')
            setNotes('')
        }
        setIsLoading(false)
    }

    // Set default date to tomorrow
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const minDate = new Date().toISOString().split('T')[0]

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px] bg-zinc-900 border-zinc-800 text-white">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-primary" />
                        Schedule Follow-up
                    </DialogTitle>
                    <DialogDescription className="text-zinc-400">
                        Schedule a follow-up task for {leadName}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={onSubmit}>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="taskType">Task Type</Label>
                            <Select value={taskType} onValueChange={(v) => setTaskType(v as typeof taskType)}>
                                <SelectTrigger className="bg-zinc-800 border-zinc-700">
                                    <SelectValue placeholder="Select task type" />
                                </SelectTrigger>
                                <SelectContent className="bg-zinc-800 border-zinc-700">
                                    {TASK_TYPES.map(type => (
                                        <SelectItem key={type.value} value={type.value}>
                                            {type.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="date">Date</Label>
                                <Input
                                    id="date"
                                    type="date"
                                    min={minDate}
                                    value={scheduledDate}
                                    onChange={(e) => setScheduledDate(e.target.value)}
                                    required
                                    className="bg-zinc-800 border-zinc-700"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="time" className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    Time
                                </Label>
                                <Input
                                    id="time"
                                    type="time"
                                    value={scheduledTime}
                                    onChange={(e) => setScheduledTime(e.target.value)}
                                    required
                                    className="bg-zinc-800 border-zinc-700"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="notes">Notes (optional)</Label>
                            <Textarea
                                id="notes"
                                placeholder="Add any notes about this follow-up..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className="bg-zinc-800 border-zinc-700 min-h-[80px]"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            className="border-zinc-700"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isLoading}
                            className="bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                            {isLoading ? 'Scheduling...' : 'Schedule'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
