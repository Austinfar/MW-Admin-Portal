'use client'

import { useState, useEffect } from 'react'
import { getLatestPaymentScheduleForClient } from '@/lib/actions/contracts'
import { sendAgreement } from '@/lib/actions/agreements'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
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
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CalendarIcon, Loader2, Send } from 'lucide-react'
import { format, addMonths } from 'date-fns'
import { toast } from 'sonner'
import { createContract } from '@/lib/actions/contracts'
import type { PaymentType } from '@/types/contract'
import { cn } from '@/lib/utils'

interface CreateContractDialogProps {
    clientId: string
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
}

export function CreateContractDialog({
    clientId,
    open,
    onOpenChange,
    onSuccess,
}: CreateContractDialogProps) {
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Form state
    const [startDate, setStartDate] = useState<Date | undefined>(new Date())
    const [programTerm, setProgramTerm] = useState<'6' | '12'>('6')
    const [programName, setProgramName] = useState('')
    const [paymentType, setPaymentType] = useState<PaymentType | ''>('')
    const [totalValue, setTotalValue] = useState('')
    const [monthlyRate, setMonthlyRate] = useState('')
    const [downPayment, setDownPayment] = useState('')
    const [installmentCount, setInstallmentCount] = useState('')
    const [installmentAmount, setInstallmentAmount] = useState('')
    const [notes, setNotes] = useState('')

    // Calculate end date based on start date and term
    const endDate = startDate ? addMonths(startDate, parseInt(programTerm)) : undefined

    // Prefill from payment schedule
    useEffect(() => {
        if (open && clientId) {
            const loadPrefill = async () => {
                try {
                    const prefillData = await getLatestPaymentScheduleForClient(clientId)
                    if (prefillData) {
                        if (prefillData.programName) setProgramName(prefillData.programName)
                        if (prefillData.paymentType) setPaymentType(prefillData.paymentType as any)
                        if (prefillData.programTerm) setProgramTerm(prefillData.programTerm as any)
                        if (prefillData.startDate) setStartDate(prefillData.startDate)
                        if (prefillData.totalValue) setTotalValue(prefillData.totalValue)
                        if (prefillData.monthlyRate) setMonthlyRate(prefillData.monthlyRate)
                        if (prefillData.downPayment) setDownPayment(prefillData.downPayment)
                        if (prefillData.installmentCount) setInstallmentCount(prefillData.installmentCount)
                        if (prefillData.installmentAmount) setInstallmentAmount(prefillData.installmentAmount)
                        if (prefillData.notes) setNotes(prefillData.notes)

                        toast.success('Prefilled contract details from payment link')
                    }
                } catch (error) {
                    console.error('Failed to prefill contract:', error)
                }
            }
            loadPrefill()
        }
    }, [open, clientId])

    async function handleSubmit(shouldSend = false) {
        if (!startDate || !programName) {
            toast.error('Please fill in required fields')
            return
        }

        setIsSubmitting(true)

        try {
            // 1. Create Contract
            const result = await createContract({
                client_id: clientId,
                start_date: format(startDate, 'yyyy-MM-dd'),
                end_date: format(endDate!, 'yyyy-MM-dd'),
                program_name: programName,
                program_term_months: parseInt(programTerm),
                payment_type: paymentType || undefined,
                total_value: totalValue ? parseFloat(totalValue) : undefined,
                monthly_rate: monthlyRate ? parseFloat(monthlyRate) : undefined,
                down_payment: downPayment ? parseFloat(downPayment) : undefined,
                installment_count: installmentCount ? parseInt(installmentCount) : undefined,
                installment_amount: installmentAmount ? parseFloat(installmentAmount) : undefined,
                manual_entry: true,
                manual_notes: notes || undefined,
            })

            if (!result.success) {
                throw new Error(result.error || 'Failed to create contract')
            }

            toast.success('Contract created successfully')

            // 2. Send Agreement (if requested)
            if (shouldSend) {
                toast.loading('Preparing agreement...')
                const sendResult = await sendAgreement(clientId)
                toast.dismiss() // Dismiss loading

                if (sendResult.success) {
                    toast.success('Agreement sent via GHL!')
                } else {
                    toast.error(`Contract created, but failed to send: ${sendResult.error}`)
                    // Do NOT close valid contract dialog? No, contract is created. We shoud close.
                }
            }

            onOpenChange(false)
            onSuccess?.()
            resetForm()

        } catch (error: any) {
            toast.error(error.message || 'An error occurred')
        } finally {
            setIsSubmitting(false)
        }
    }

    function resetForm() {
        setStartDate(new Date())
        setProgramTerm('6')
        setProgramName('')
        setPaymentType('')
        setTotalValue('')
        setMonthlyRate('')
        setDownPayment('')
        setInstallmentCount('')
        setInstallmentAmount('')
        setNotes('')
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Create Contract</DialogTitle>
                    <DialogDescription>
                        Manually create a contract record for this client.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Program Name */}
                    <div className="space-y-2">
                        <Label htmlFor="programName">Program Name *</Label>
                        <Input
                            id="programName"
                            placeholder="e.g., Competition Prep Coaching"
                            value={programName}
                            onChange={(e) => setProgramName(e.target.value)}
                        />
                    </div>

                    {/* Start Date and Term */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Start Date *</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className={cn(
                                            'w-full justify-start text-left font-normal',
                                            !startDate && 'text-muted-foreground'
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {startDate ? format(startDate, 'PPP') : 'Pick a date'}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar
                                        mode="single"
                                        selected={startDate}
                                        onSelect={setStartDate}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="space-y-2">
                            <Label>Program Term *</Label>
                            <Select value={programTerm} onValueChange={(v) => setProgramTerm(v as '6' | '12')}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="6">6 months</SelectItem>
                                    <SelectItem value="12">12 months</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* End Date (calculated) */}
                    {endDate && (
                        <div className="text-sm text-muted-foreground">
                            Contract ends: <span className="font-medium">{format(endDate, 'PPP')}</span>
                        </div>
                    )}

                    {/* Payment Type */}
                    <div className="space-y-2">
                        <Label>Payment Type</Label>
                        <Select value={paymentType} onValueChange={(v) => setPaymentType(v as PaymentType)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select payment type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="paid_in_full">Paid in Full</SelectItem>
                                <SelectItem value="split_pay">Split Payment</SelectItem>
                                <SelectItem value="monthly">Monthly</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Payment Details based on type */}
                    {paymentType === 'paid_in_full' && (
                        <div className="space-y-2">
                            <Label htmlFor="totalValue">Total Value ($)</Label>
                            <Input
                                id="totalValue"
                                type="number"
                                placeholder="0.00"
                                value={totalValue}
                                onChange={(e) => setTotalValue(e.target.value)}
                            />
                        </div>
                    )}

                    {paymentType === 'split_pay' && (
                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="downPayment">Down Payment ($)</Label>
                                <Input
                                    id="downPayment"
                                    type="number"
                                    placeholder="0.00"
                                    value={downPayment}
                                    onChange={(e) => setDownPayment(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="installmentCount"># Installments</Label>
                                <Input
                                    id="installmentCount"
                                    type="number"
                                    placeholder="0"
                                    value={installmentCount}
                                    onChange={(e) => setInstallmentCount(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="installmentAmount">Per Payment ($)</Label>
                                <Input
                                    id="installmentAmount"
                                    type="number"
                                    placeholder="0.00"
                                    value={installmentAmount}
                                    onChange={(e) => setInstallmentAmount(e.target.value)}
                                />
                            </div>
                        </div>
                    )}

                    {paymentType === 'monthly' && (
                        <div className="space-y-2">
                            <Label htmlFor="monthlyRate">Monthly Rate ($)</Label>
                            <Input
                                id="monthlyRate"
                                type="number"
                                placeholder="0.00"
                                value={monthlyRate}
                                onChange={(e) => setMonthlyRate(e.target.value)}
                            />
                        </div>
                    )}

                    {/* Notes */}
                    <div className="space-y-2">
                        <Label htmlFor="notes">Notes</Label>
                        <Textarea
                            id="notes"
                            placeholder="Any additional notes about this contract..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                        />
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:justify-end">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <div className="flex gap-2">
                        <Button
                            variant="secondary"
                            onClick={() => handleSubmit(false)}
                            disabled={isSubmitting || !programName || !startDate}
                        >
                            Create Only
                        </Button>
                        <Button
                            onClick={() => handleSubmit(true)}
                            disabled={isSubmitting || !programName || !startDate}
                            className="bg-green-600 hover:bg-green-700 text-white"
                        >
                            {isSubmitting ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Send className="mr-2 h-4 w-4" />
                            )}
                            Create & Send
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
