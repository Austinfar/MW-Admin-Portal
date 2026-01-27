'use client'

import { useState, useEffect } from 'react'
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
    CalendarIcon,
    Loader2,
    CreditCard,
    ExternalLink,
    FileText,
} from 'lucide-react'
import { format, addMonths, addDays } from 'date-fns'
import { toast } from 'sonner'
import { getContract, renewContract } from '@/lib/actions/contracts'
import type { ClientContract } from '@/types/contract'
import { cn } from '@/lib/utils'

interface RenewContractDialogProps {
    clientId: string
    previousContractId: string
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
}

type RenewalMethod = 'payment_link' | 'card_on_file' | 'manual'

export function RenewContractDialog({
    clientId,
    previousContractId,
    open,
    onOpenChange,
    onSuccess,
}: RenewContractDialogProps) {
    const [isLoading, setIsLoading] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [previousContract, setPreviousContract] = useState<ClientContract | null>(null)

    // Form state
    const [renewalMethod, setRenewalMethod] = useState<RenewalMethod>('manual')
    const [startDate, setStartDate] = useState<Date | undefined>(undefined)
    const [programTerm, setProgramTerm] = useState<'6' | '12'>('6')
    const [programName, setProgramName] = useState('')
    const [totalValue, setTotalValue] = useState('')
    const [monthlyRate, setMonthlyRate] = useState('')
    const [notes, setNotes] = useState('')

    // Load previous contract data
    useEffect(() => {
        if (open && previousContractId) {
            loadPreviousContract()
        }
    }, [open, previousContractId])

    async function loadPreviousContract() {
        setIsLoading(true)
        const contract = await getContract(previousContractId)
        if (contract) {
            setPreviousContract(contract)
            // Pre-fill form with previous contract data
            setProgramName(contract.program_name)
            setProgramTerm(contract.program_term_months === 12 ? '12' : '6')
            // Default start date to day after previous end date
            setStartDate(addDays(new Date(contract.end_date), 1))
            if (contract.total_value) setTotalValue(contract.total_value.toString())
            if (contract.monthly_rate) setMonthlyRate(contract.monthly_rate.toString())
        }
        setIsLoading(false)
    }

    // Calculate end date
    const endDate = startDate ? addMonths(startDate, parseInt(programTerm)) : undefined

    async function handleSubmit() {
        if (!startDate || !programName) {
            toast.error('Please fill in required fields')
            return
        }

        if (renewalMethod === 'payment_link') {
            // Redirect to payment link generator
            toast.info('Redirecting to payment link generator...')
            window.location.href = `/payment-links?clientId=${clientId}&renewal=true`
            return
        }

        if (renewalMethod === 'card_on_file') {
            // For now, show a message that this feature is coming
            toast.info('Charging card on file is not yet implemented. Please use manual entry or create a payment link.')
            return
        }

        // Manual renewal
        setIsSubmitting(true)

        const result = await renewContract({
            client_id: clientId,
            previous_contract_id: previousContractId,
            start_date: format(startDate, 'yyyy-MM-dd'),
            program_term_months: parseInt(programTerm),
            program_name: programName,
            renewal_method: renewalMethod,
            total_value: totalValue ? parseFloat(totalValue) : undefined,
            monthly_rate: monthlyRate ? parseFloat(monthlyRate) : undefined,
            manual_notes: notes || undefined,
        })

        setIsSubmitting(false)

        if (result.success) {
            toast.success('Contract renewed successfully')
            onOpenChange(false)
            onSuccess?.()
        } else {
            toast.error(result.error || 'Failed to renew contract')
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Renew Contract</DialogTitle>
                    <DialogDescription>
                        Create a new contract period for this client.
                    </DialogDescription>
                </DialogHeader>

                {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <div className="space-y-4 py-4">
                        {/* Previous contract info */}
                        {previousContract && (
                            <div className="rounded-lg bg-muted/50 p-3 text-sm">
                                <p className="font-medium">Previous Contract</p>
                                <p className="text-muted-foreground">
                                    {previousContract.program_name} •{' '}
                                    {format(new Date(previousContract.start_date), 'MMM d, yyyy')} -{' '}
                                    {format(new Date(previousContract.end_date), 'MMM d, yyyy')}
                                </p>
                            </div>
                        )}

                        {/* Renewal Method */}
                        <div className="space-y-3">
                            <Label>How will this renewal be paid?</Label>
                            <RadioGroup
                                value={renewalMethod}
                                onValueChange={(v) => setRenewalMethod(v as RenewalMethod)}
                                className="grid gap-2"
                            >
                                <Label
                                    htmlFor="payment_link"
                                    className={cn(
                                        'flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors',
                                        renewalMethod === 'payment_link' && 'border-primary bg-primary/5'
                                    )}
                                >
                                    <RadioGroupItem value="payment_link" id="payment_link" />
                                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                                    <div>
                                        <p className="font-medium">Create Payment Link</p>
                                        <p className="text-xs text-muted-foreground">
                                            Generate a new payment link for the client
                                        </p>
                                    </div>
                                </Label>

                                <Label
                                    htmlFor="card_on_file"
                                    className={cn(
                                        'flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors opacity-50',
                                        renewalMethod === 'card_on_file' && 'border-primary bg-primary/5'
                                    )}
                                >
                                    <RadioGroupItem value="card_on_file" id="card_on_file" disabled />
                                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                                    <div>
                                        <p className="font-medium">Charge Card on File</p>
                                        <p className="text-xs text-muted-foreground">
                                            Coming soon - Charge the client's saved payment method
                                        </p>
                                    </div>
                                </Label>

                                <Label
                                    htmlFor="manual"
                                    className={cn(
                                        'flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors',
                                        renewalMethod === 'manual' && 'border-primary bg-primary/5'
                                    )}
                                >
                                    <RadioGroupItem value="manual" id="manual" />
                                    <FileText className="h-4 w-4 text-muted-foreground" />
                                    <div>
                                        <p className="font-medium">Manual Entry</p>
                                        <p className="text-xs text-muted-foreground">
                                            Record a renewal without processing payment
                                        </p>
                                    </div>
                                </Label>
                            </RadioGroup>
                        </div>

                        {/* Only show details for manual entry */}
                        {renewalMethod === 'manual' && (
                            <>
                                {/* Program Name */}
                                <div className="space-y-2">
                                    <Label htmlFor="programName">Program Name *</Label>
                                    <Input
                                        id="programName"
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

                                {/* End Date */}
                                {endDate && (
                                    <div className="text-sm text-muted-foreground">
                                        Contract ends: <span className="font-medium">{format(endDate, 'PPP')}</span>
                                    </div>
                                )}

                                {/* Payment Details */}
                                <div className="grid grid-cols-2 gap-4">
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
                                </div>

                                {/* Notes */}
                                <div className="space-y-2">
                                    <Label htmlFor="notes">Notes</Label>
                                    <Textarea
                                        id="notes"
                                        placeholder="Any notes about this renewal..."
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                    />
                                </div>
                            </>
                        )}
                    </div>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isSubmitting || isLoading || (renewalMethod === 'manual' && (!programName || !startDate))}
                    >
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {renewalMethod === 'payment_link' ? 'Create Payment Link' : 'Renew Contract'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
