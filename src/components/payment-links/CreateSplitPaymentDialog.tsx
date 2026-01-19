'use client'

import { useState } from 'react'
import { CalendarIcon, Copy, Loader2, Plus, Trash2, ExternalLink } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'

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
import { Switch } from '@/components/ui/switch'
import { Calendar } from '@/components/ui/calendar'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Check } from 'lucide-react'

import { createSplitPaymentDraft } from '@/lib/actions/stripe-actions'

interface ScheduledCharge {
    amount: number // in dollars for input, converted to cents for logic
    date: Date
}

interface Coach {
    id: string
    name: string | null
    avatar_url?: string | null
}

export function CreateSplitPaymentDialog({
    children,
    defaultPriceName = "1:1 Coaching (Split Payment)",
    prices = [],
    coaches = []
}: {
    children: React.ReactNode
    defaultPriceName?: string
    prices?: { id: string; product_id: string; product_name: string }[]
    coaches?: Coach[]
}) {
    const [open, setOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)

    // Form State
    const [planName, setPlanName] = useState(defaultPriceName)
    const [downPayment, setDownPayment] = useState<number>(1000)
    const [futurePayments, setFuturePayments] = useState<ScheduledCharge[]>([])

    // Config State
    const [startDate, setStartDate] = useState<Date | undefined>(new Date())
    const [selectedCoachId, setSelectedCoachId] = useState<string>('tbd')

    // Result State
    const [generatedLink, setGeneratedLink] = useState<string | null>(null)

    const addPayment = () => {
        const nextMonth = new Date()
        nextMonth.setMonth(nextMonth.getMonth() + 1 + futurePayments.length)

        setFuturePayments([
            ...futurePayments,
            { amount: 1000, date: nextMonth }
        ])
    }

    const removePayment = (index: number) => {
        const newPayments = [...futurePayments]
        newPayments.splice(index, 1)
        setFuturePayments(newPayments)
    }

    const updatePayment = (index: number, field: keyof ScheduledCharge, value: any) => {
        const newPayments = [...futurePayments]
        newPayments[index] = { ...newPayments[index], [field]: value }
        setFuturePayments(newPayments)
    }

    const totalAmount = downPayment + futurePayments.reduce((sum, p) => sum + (p.amount || 0), 0)

    const handleGenerate = async () => {
        setIsLoading(true)
        setGeneratedLink(null)
        try {
            // Find price ID (productId)
            const selectedPrice = prices.find(p => p.product_name === planName)
            const productId = selectedPrice?.product_id // Use Product ID explicitly to allow custom amount

            // Convert to cents and serializable dates
            const payload = {
                planName,
                downPayment: Math.round(downPayment * 100),
                schedule: futurePayments.map(p => ({
                    amount: Math.round(p.amount * 100),
                    dueDate: p.date.toISOString(),
                })),
                productId, // Pass the linked ID
                coachId: selectedCoachId,
                startDate: startDate?.toISOString()
            }

            const result = await createSplitPaymentDraft(payload)

            if (result.error) {
                toast.error(result.error)
                return
            }

            if (result.id) {
                // Construct internal URL
                const baseUrl = window.location.origin
                const url = `${baseUrl}/pay/${result.id}`

                setGeneratedLink(url)
                toast.success("Payment Plan generated!")
            }
        } catch (error) {
            console.error(error)
            toast.error("Failed to generate link")
        } finally {
            setIsLoading(false)
        }
    }

    const copyToClipboard = () => {
        if (generatedLink) {
            navigator.clipboard.writeText(generatedLink)
            toast.success("Copied to clipboard")
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {children}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Create Split Payment Plan</DialogTitle>
                    <DialogDescription>
                        Define the down payment and future installment schedule.
                    </DialogDescription>
                </DialogHeader>

                {!generatedLink ? (
                    <div className="grid gap-6 py-4">
                        {/* 1. Product & Coach Config */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="planName">Select Product</Label>
                                {prices.length > 0 ? (
                                    <Select
                                        value={planName}
                                        onValueChange={(val) => setPlanName(val)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a product..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {prices.map(p => (
                                                <SelectItem key={p.id} value={p.product_name}>
                                                    {p.product_name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <p className="text-sm text-destructive">No products found.</p>
                                )}
                            </div>

                            <div className="grid gap-2">
                                <Label>Assign Coach (Optional)</Label>
                                <Select
                                    value={selectedCoachId}
                                    onValueChange={setSelectedCoachId}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Coach" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="tbd">TBD / No Preference</SelectItem>
                                        {coaches.map((coach) => (
                                            <SelectItem key={coach.id} value={coach.id}>
                                                {coach.name || 'Unnamed Coach'}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* 2. Start Date */}
                        <div className="grid gap-2">
                            <Label>Start Date</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn(
                                            "w-full justify-start text-left font-normal",
                                            !startDate && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {startDate ? format(startDate, "PPP") : <span>Pick a start date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={startDate}
                                        onSelect={setStartDate}
                                        disabled={(date) =>
                                            date < new Date(new Date().setHours(0, 0, 0, 0))
                                        }
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="downPayment">First Payment ($)</Label>
                            <Input
                                id="downPayment"
                                type="number"
                                value={downPayment}
                                onChange={(e) => setDownPayment(parseFloat(e.target.value) || 0)}
                            />
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <Label>Scheduled Payments</Label>
                                <Button variant="outline" size="sm" onClick={addPayment}>
                                    <Plus className="w-4 h-4 mr-2" />
                                    Add Payment
                                </Button>
                            </div>

                            {futurePayments.map((payment, index) => (
                                <div key={index} className="flex gap-4 items-start border p-3 rounded-md bg-muted/20">
                                    <div className="grid gap-2 flex-1">
                                        <Label className="text-xs">Amount ($)</Label>
                                        <Input
                                            type="number"
                                            value={payment.amount}
                                            onChange={(e) => updatePayment(index, 'amount', parseFloat(e.target.value) || 0)}
                                        />
                                    </div>
                                    <div className="grid gap-2 flex-1">
                                        <Label className="text-xs">Due Date</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant={"outline"}
                                                    className={cn(
                                                        "w-full justify-start text-left font-normal",
                                                        !payment.date && "text-muted-foreground"
                                                    )}
                                                >
                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                    {payment.date ? format(payment.date, "PPP") : <span>Pick a date</span>}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0">
                                                <Calendar
                                                    mode="single"
                                                    selected={payment.date}
                                                    onSelect={(date) => updatePayment(index, 'date', date)}
                                                    initialFocus
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="mt-6 text-destructive hover:bg-destructive/10"
                                        onClick={() => removePayment(index)}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            ))}

                            {futurePayments.length === 0 && (
                                <p className="text-sm text-muted-foreground italic text-center py-4 border border-dashed rounded-md">
                                    No scheduled payments added. This will just be a one-time charge.
                                </p>
                            )}
                        </div>

                        <div className="flex justify-end pt-4 border-t">
                            <div className="text-right">
                                <p className="text-sm text-muted-foreground">Total Plan Value</p>
                                <p className="text-2xl font-bold">${totalAmount.toLocaleString()}</p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="py-8 space-y-4">
                        <div className="bg-green-50 border border-green-200 rounded-md p-4 flex flex-col items-center justify-center text-center space-y-2">
                            <div className="bg-green-100 p-2 rounded-full">
                                <Check className="w-6 h-6 text-green-600" />
                            </div>
                            <h3 className="font-semibold text-green-800">Plan Created Successfully</h3>
                            <p className="text-sm text-green-700">The down payment link is ready. Future charges are scheduled.</p>
                        </div>

                        <div className="flex gap-2">
                            <Input value={generatedLink} readOnly />
                            <Button size="icon" variant="outline" onClick={copyToClipboard}>
                                <Copy className="w-4 h-4" />
                            </Button>
                        </div>

                        <Button className="w-full" asChild>
                            <a href={generatedLink} target="_blank" rel="noopener noreferrer">
                                Open Payment Link <ExternalLink className="ml-2 w-4 h-4" />
                            </a>
                        </Button>

                        <Button variant="ghost" className="w-full" onClick={() => {
                            setGeneratedLink(null)
                            // Keep previous form state? Or reset?
                            // Let's keep it so they can verify/tweak if needed, or close.
                        }}>
                            Create Another
                        </Button>
                    </div>
                )}

                <DialogFooter>
                    {!generatedLink && (
                        <Button onClick={handleGenerate} disabled={isLoading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Generate Split Plan
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}


