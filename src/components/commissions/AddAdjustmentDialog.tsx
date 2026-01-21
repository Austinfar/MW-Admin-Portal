'use client'

import { useState, useEffect } from 'react'
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { addAdjustment, getAllUsers } from '@/lib/actions/payroll'
import { toast } from 'sonner'
import { Loader2, Plus } from 'lucide-react'

interface AddAdjustmentDialogProps {
    runId?: string
    userId?: string // Pre-selected user
    onSuccess?: () => void
}

type AdjustmentType = 'bonus' | 'deduction' | 'correction' | 'chargeback' | 'referral'

const ADJUSTMENT_TYPES: { value: AdjustmentType; label: string; description: string }[] = [
    { value: 'bonus', label: 'Bonus', description: 'Discretionary bonus payment' },
    { value: 'deduction', label: 'Deduction', description: 'General deduction' },
    { value: 'correction', label: 'Correction', description: 'Fix to previous calculation' },
    { value: 'chargeback', label: 'Chargeback', description: 'Stripe refund or dispute' },
    { value: 'referral', label: 'Referral', description: 'Referral bonus' }
]

export function AddAdjustmentDialog({ runId, userId: preselectedUserId, onSuccess }: AddAdjustmentDialogProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [users, setUsers] = useState<{ id: string; name: string | null; email: string }[]>([])
    const [loadingUsers, setLoadingUsers] = useState(true)

    const [selectedUserId, setSelectedUserId] = useState(preselectedUserId || '')
    const [amount, setAmount] = useState('')
    const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>('bonus')
    const [reason, setReason] = useState('')
    const [notes, setNotes] = useState('')

    useEffect(() => {
        async function fetchUsers() {
            try {
                const data = await getAllUsers()
                setUsers(data.map(u => ({ id: u.id, name: u.name, email: u.email || '' })))
            } catch (error) {
                console.error('Failed to fetch users:', error)
            } finally {
                setLoadingUsers(false)
            }
        }
        if (open) {
            fetchUsers()
        }
    }, [open])

    async function handleSubmit() {
        if (!selectedUserId) {
            toast.error('Please select a user')
            return
        }

        const numAmount = parseFloat(amount)
        if (isNaN(numAmount) || numAmount === 0) {
            toast.error('Please enter a valid amount')
            return
        }

        if (reason.trim().length < 5) {
            toast.error('Please provide a reason (at least 5 characters)')
            return
        }

        // Make deductions negative
        const finalAmount = adjustmentType === 'deduction' || adjustmentType === 'chargeback'
            ? -Math.abs(numAmount)
            : Math.abs(numAmount)

        setLoading(true)
        try {
            const result = await addAdjustment(
                selectedUserId,
                finalAmount,
                adjustmentType,
                reason,
                {
                    runId,
                    notes: notes || undefined,
                    isVisibleToUser: true
                }
            )

            if (result.error) {
                toast.error(result.error)
            } else {
                toast.success('Adjustment added successfully')
                setOpen(false)
                resetForm()
                onSuccess?.()
            }
        } catch (error) {
            console.error('Failed to add adjustment:', error)
            toast.error('Failed to add adjustment')
        } finally {
            setLoading(false)
        }
    }

    function resetForm() {
        setSelectedUserId(preselectedUserId || '')
        setAmount('')
        setAdjustmentType('bonus')
        setReason('')
        setNotes('')
    }

    return (
        <Dialog open={open} onOpenChange={(isOpen) => {
            setOpen(isOpen)
            if (!isOpen) resetForm()
        }}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Adjustment
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Add Adjustment</DialogTitle>
                    <DialogDescription>
                        Add a manual adjustment (bonus, deduction, or correction) to this payroll run.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="user">Recipient</Label>
                        {loadingUsers ? (
                            <div className="flex items-center justify-center py-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                            </div>
                        ) : (
                            <Select
                                value={selectedUserId}
                                onValueChange={setSelectedUserId}
                                disabled={!!preselectedUserId}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select user..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {users.map(user => (
                                        <SelectItem key={user.id} value={user.id}>
                                            {user.name || user.email}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="type">Type</Label>
                        <Select
                            value={adjustmentType}
                            onValueChange={(value) => setAdjustmentType(value as AdjustmentType)}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {ADJUSTMENT_TYPES.map(type => (
                                    <SelectItem key={type.value} value={type.value}>
                                        <div>
                                            <span>{type.label}</span>
                                            <span className="text-xs text-muted-foreground ml-2">
                                                ({type.description})
                                            </span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="amount">
                            Amount ($)
                            {(adjustmentType === 'deduction' || adjustmentType === 'chargeback') && (
                                <span className="text-xs text-muted-foreground ml-2">(will be negative)</span>
                            )}
                        </Label>
                        <Input
                            id="amount"
                            type="number"
                            step="0.01"
                            placeholder="100.00"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="reason">Reason</Label>
                        <Input
                            id="reason"
                            placeholder="Brief description..."
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                            This will be visible to the recipient
                        </p>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="notes">Notes (optional)</Label>
                        <Textarea
                            id="notes"
                            placeholder="Internal notes..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={2}
                        />
                        <p className="text-xs text-muted-foreground">
                            Internal notes (only visible to admins)
                        </p>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Add Adjustment
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
