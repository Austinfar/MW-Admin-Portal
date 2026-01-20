'use client';

import React, { useState } from 'react'
import { format, addDays, startOfMonth, addMonths } from 'date-fns'
import { Calendar as CalendarIcon, Check, ChevronsUpDown, CreditCard, Repeat, Split, Trash2, User, Copy, ExternalLink, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { createStandardPaymentRef, createCheckoutSession } from '@/lib/actions/stripe-actions'
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { CreateSplitPaymentDialog } from './CreateSplitPaymentDialog'
import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Switch } from '@/components/ui/switch'

interface ProductPrice {
    id: string
    product_id: string
    product_name: string
    unit_amount: number | null
    currency: string
    type: string // 'one_time' or 'recurring'
    recurring: { interval: string } | null
}

interface Coach {
    id: string
    name: string | null
    avatar_url?: string | null
}

interface SalesCloser {
    id: string
    name: string | null
    avatar_url?: string | null
}

export interface CommissionSplit {
    userId: string
    role: 'Closer' | 'Referrer'
    percentage: number
}

interface Client {
    id: string
    name: string
    email: string
    stripe_customer_id: string | null
    assigned_coach_id: string | null
    start_date: string | null
}

import { ClientType } from '@/types/client'

interface Lead {
    id: string
    first_name: string
    last_name: string | null
    email: string | null
    phone: string | null
}

interface PaymentLinkGeneratorsProps {
    prices: ProductPrice[]
    isTestMode: boolean
    coaches: Coach[]
    closers: SalesCloser[]
    clients: Client[]
    leads: Lead[]
    clientTypes: ClientType[]
}

export interface LinkConfig {
    startDate: Date | undefined
    coachId: string
    salesCloserId: string
    clientId: string
    leadId: string
    clientTypeId?: string
    commissionSplits: CommissionSplit[]
    programTerm: '6' | '12'
}

// Helper to deduplicate products (if we only want to show one price option per product or just unique product names - user asked to fix "repeating projects" which implies products appearing multiple times)
// Assuming we want to show unique products. If multiple prices exist for same product, we might want to handle that differently (e.g. variants). 
// For now, let's just make sure we don't show exact duplicates and sort by price.
export function PaymentLinkGenerators({ prices, isTestMode, coaches, closers, clients, leads, clientTypes }: PaymentLinkGeneratorsProps) {
    // Deduplicate prices by ID to avoid strict duplicates
    const uniquePrices = prices.filter((price, index, self) =>
        index === self.findIndex((p) => (
            p.id === price.id
        ))
    );

    // Sort prices: lowest to highest unit_amount
    const sortedPrices = uniquePrices.sort((a, b) => {
        const priceA = a.unit_amount || 0;
        const priceB = b.unit_amount || 0;
        return priceA - priceB;
    });

    // Let's ensure we use sortedPrices everywhere.
    // Global Config State
    const [activeTab, setActiveTab] = useState<'standard' | 'split'>('standard')

    // Standard Generatory State
    const [selectedPriceId, setSelectedPriceId] = useState<string>('')
    const [customAmount, setCustomAmount] = useState<string>('') // For overriding
    const [selectedCoachId, setSelectedCoachId] = useState<string>('tbd')
    const [selectedCloserId, setSelectedCloserId] = useState<string>('tbd')
    const [selectedClientId, setSelectedClientId] = useState<string>('new')
    const [selectedLeadId, setSelectedLeadId] = useState<string>('') // If linked to a lead
    const [selectedClientTypeId, setSelectedClientTypeId] = useState<string>('')
    const [startDate, setStartDate] = useState<Date | undefined>(undefined)
    const [programTerm, setProgramTerm] = useState<'6' | '12'>('6')
    const [commissionSplits, setCommissionSplits] = useState<CommissionSplit[]>([])
    const [commissionSplitEnabled, setCommissionSplitEnabled] = useState(false)

    // Split Payment State for Splits
    const [isSplitDialogOpen, setIsSplitDialogOpen] = useState(false)
    const [isClientOpen, setIsClientOpen] = useState(false)

    // USE sortedPrices HERE
    const oneTimePrices = sortedPrices.filter(p => p.type === 'one_time' && p.unit_amount !== null)
    const recurringPrices = sortedPrices.filter(p => p.type === 'recurring' && p.unit_amount !== null && p.recurring?.interval === 'month')

    const config: LinkConfig = {
        startDate,
        coachId: selectedCoachId,
        salesCloserId: selectedCloserId,
        clientId: selectedClientId,
        leadId: selectedLeadId,
        commissionSplits: commissionSplits,
        programTerm: programTerm
    }

    // Require either a lead OR a client, AND a coach to be selected
    const isConfigValid = !!startDate && (!!selectedClientId || !!selectedLeadId) && !!selectedCoachId

    // Helper to get selected person's display name
    const getSelectedPersonName = () => {
        if (selectedLeadId) {
            const lead = leads.find(l => l.id === selectedLeadId)
            return lead ? `${lead.first_name} ${lead.last_name || ''}`.trim() : null
        }
        if (selectedClientId) {
            const client = clients.find(c => c.id === selectedClientId)
            return client?.name || null
        }
        return null
    }

    // Helper for date presets
    const setDatePreset = (preset: 'today' | 'tomorrow' | 'next_month') => {
        const today = new Date()
        if (preset === 'today') setStartDate(today)
        if (preset === 'tomorrow') setStartDate(addDays(today, 1))
        if (preset === 'next_month') setStartDate(startOfMonth(addMonths(today, 1)))
    }

    return (
        <div className="space-y-8">
            {/* Top Global Configuration Card */}
            <Card className="border-2 border-border/50 bg-card/50 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <User className="h-5 w-5 text-primary" />
                        Link Configuration & Attribution
                    </CardTitle>
                    <CardDescription>
                        Set the default parameters for the payment link. These fields are required to unlock the generators.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* 1. Lead/Client Selector (Leads on top) */}
                        <div className="space-y-2">
                            <Label>Lead / Client</Label>
                            <Popover open={isClientOpen} onOpenChange={setIsClientOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={isClientOpen}
                                        className={cn(
                                            "w-full justify-between",
                                            !selectedClientId && !selectedLeadId && "text-muted-foreground"
                                        )}
                                    >
                                        {getSelectedPersonName() || "Select Lead or Client..."}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[350px] p-0">
                                    <Command>
                                        <CommandInput placeholder="Search leads and clients..." />
                                        <CommandList>
                                            <CommandEmpty>No results found.</CommandEmpty>
                                            {leads.length > 0 && (
                                                <CommandGroup heading="Leads">
                                                    {leads.map((lead) => (
                                                        <CommandItem
                                                            key={`lead-${lead.id}`}
                                                            value={`${lead.first_name} ${lead.last_name || ''} ${lead.email || ''}`}
                                                            onSelect={() => {
                                                                setSelectedLeadId(lead.id)
                                                                setSelectedClientId('')
                                                                setIsClientOpen(false)
                                                            }}
                                                        >
                                                            <Check
                                                                className={cn(
                                                                    "mr-2 h-4 w-4",
                                                                    selectedLeadId === lead.id ? "opacity-100" : "opacity-0"
                                                                )}
                                                            />
                                                            <div className="flex flex-col">
                                                                <span>{lead.first_name} {lead.last_name}</span>
                                                                {lead.email && <span className="text-xs text-muted-foreground">{lead.email}</span>}
                                                            </div>
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            )}
                                            <CommandGroup heading="Clients">
                                                {clients.map((client) => (
                                                    <CommandItem
                                                        key={`client-${client.id}`}
                                                        value={`${client.name} ${client.email}`}
                                                        onSelect={() => {
                                                            setSelectedClientId(client.id)
                                                            setSelectedLeadId('')
                                                            setIsClientOpen(false)
                                                            // Auto-template coach
                                                            if (client.assigned_coach_id) {
                                                                setSelectedCoachId(client.assigned_coach_id)
                                                                toast.success("Coach auto-selected from client record")
                                                            }
                                                            // Auto-template start date
                                                            if (client.start_date) {
                                                                // Append T12:00:00 to avoid timezone issues with YYYY-MM-DD strings being treated as UTC midnight
                                                                // or just use new Date(client.start_date) if standard
                                                                // Assuming YYYY-MM-DD
                                                                const date = new Date(client.start_date)
                                                                // Check if valid
                                                                if (!isNaN(date.getTime())) {
                                                                    setStartDate(date)
                                                                    toast.success("Start date auto-selected from client record")
                                                                }
                                                            }
                                                        }}
                                                    >
                                                        <Check
                                                            className={cn(
                                                                "mr-2 h-4 w-4",
                                                                selectedClientId === client.id ? "opacity-100" : "opacity-0"
                                                            )}
                                                        />
                                                        <div className="flex flex-col">
                                                            <span>{client.name}</span>
                                                            {client.email && <span className="text-xs text-muted-foreground">{client.email}</span>}
                                                        </div>
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>

                        {/* 2. Start Date */}
                        <div className="space-y-2">
                            <Label>Start Date & Billing Anchor</Label>
                            <div className="flex flex-col gap-2">
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant={"outline"}
                                            className={cn(
                                                "w-full justify-start text-left font-normal h-10",
                                                !startDate && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {startDate ? format(startDate, "PPP") : <span>Pick a start date</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <div className="flex">
                                            <div className="border-r p-3 space-y-2">
                                                <Label className="text-xs text-muted-foreground mb-2 block">Quick Select</Label>
                                                <Button variant="ghost" size="sm" className="w-full justify-start text-xs" onClick={() => setDatePreset('today')}>Today</Button>
                                                <Button variant="ghost" size="sm" className="w-full justify-start text-xs" onClick={() => setDatePreset('tomorrow')}>Tomorrow</Button>
                                                <Button variant="ghost" size="sm" className="w-full justify-start text-xs" onClick={() => setDatePreset('next_month')}>1st of Next Month</Button>
                                            </div>
                                            <div className="p-3">
                                                <Calendar
                                                    mode="single"
                                                    selected={startDate}
                                                    onSelect={setStartDate}
                                                    disabled={(date) =>
                                                        date < new Date(new Date().setHours(0, 0, 0, 0))
                                                    }
                                                    initialFocus
                                                />
                                            </div>
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>

                        {/* 3. Assigned Coach */}
                        <div className="space-y-2">
                            <Label>Assigned Coach</Label>
                            <Select
                                value={selectedCoachId}
                                onValueChange={setSelectedCoachId}
                            >
                                <SelectTrigger className="h-10">
                                    <SelectValue placeholder="Select Coach..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="tbd">TBD / No Preference</SelectItem>
                                    {coaches.map((coach) => (
                                        <SelectItem key={coach.id} value={coach.id}>
                                            <div className="flex items-center gap-2">
                                                <Avatar className="h-5 w-5">
                                                    <AvatarImage src={coach.avatar_url || ''} />
                                                    <AvatarFallback className="text-[10px]">
                                                        {coach.name?.[0] || '?'}
                                                    </AvatarFallback>
                                                </Avatar>
                                                {coach.name || 'Unnamed Coach'}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* 4. Program Type */}
                        <div className="space-y-2">
                            <Label>Program (For Automation)</Label>
                            <Select value={selectedClientTypeId} onValueChange={setSelectedClientTypeId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Program Type..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {clientTypes.filter(ct => ct.is_active).map((type) => (
                                        <SelectItem key={type.id} value={type.id}>
                                            {type.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-[10px] text-muted-foreground">
                                Selecting a program ensures correct onboarding tasks are assigned.
                            </p>
                        </div>

                        {/* 5. Program Term - Toggle Switch Style */}
                        <div className="space-y-2">
                            <Label>Program Term</Label>
                            <div className="flex rounded-lg border border-white/10 overflow-hidden h-10">
                                <button
                                    type="button"
                                    onClick={() => setProgramTerm('6')}
                                    className={cn(
                                        "flex-1 px-4 text-sm font-medium transition-colors",
                                        programTerm === '6'
                                            ? "bg-primary text-primary-foreground"
                                            : "bg-white/5 text-muted-foreground hover:bg-white/10"
                                    )}
                                >
                                    6 Months
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setProgramTerm('12')}
                                    className={cn(
                                        "flex-1 px-4 text-sm font-medium transition-colors",
                                        programTerm === '12'
                                            ? "bg-primary text-primary-foreground"
                                            : "bg-white/5 text-muted-foreground hover:bg-white/10"
                                    )}
                                >
                                    12 Months
                                </button>
                            </div>
                        </div>

                        {/* 6. Split Commission / Sales Config */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label>Commission Split</Label>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">Enable</span>
                                    <Switch
                                        checked={commissionSplitEnabled}
                                        onCheckedChange={(checked) => {
                                            setCommissionSplitEnabled(checked)
                                            if (!checked) {
                                                setCommissionSplits([]) // Clear splits when disabled
                                            }
                                        }}
                                    />
                                </div>
                            </div>
                            {commissionSplitEnabled ? (
                                <Dialog open={isSplitDialogOpen} onOpenChange={setIsSplitDialogOpen}>
                                    <DialogTrigger asChild>
                                        <Button variant="outline" className="w-full justify-between h-10">
                                            {commissionSplits.length > 0
                                                ? `${commissionSplits.length} Split(s) Configured`
                                                : "Configure Splits"}
                                            <Split className="w-4 h-4 ml-2 opacity-50" />
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-lg">
                                        <DialogHeader>
                                            <DialogTitle>Configure Commission Splits</DialogTitle>
                                            <DialogDescription>
                                                Add a Closer and/or Referrer with their commission percentage.
                                            </DialogDescription>
                                        </DialogHeader>

                                        <div className="space-y-6 py-4">
                                            {/* Closer Section */}
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-2 w-2 rounded-full bg-blue-500" />
                                                        <Label className="font-semibold">Sales Closer</Label>
                                                    </div>
                                                    <span className="text-xs text-muted-foreground">10% of gross revenue</span>
                                                </div>
                                                <Select
                                                    value={commissionSplits.find(s => s.role === 'Closer')?.userId || 'none'}
                                                    onValueChange={(userId) => {
                                                        if (userId === 'none') {
                                                            setCommissionSplits(prev => prev.filter(s => s.role !== 'Closer'))
                                                        } else {
                                                            const existing = commissionSplits.find(s => s.role === 'Closer')
                                                            if (existing) {
                                                                setCommissionSplits(prev => prev.map(s =>
                                                                    s.role === 'Closer' ? { ...s, userId } : s
                                                                ))
                                                            } else {
                                                                setCommissionSplits(prev => [...prev, { userId, role: 'Closer', percentage: 10 }])
                                                            }
                                                        }
                                                    }}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select Closer (optional)..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="none">None</SelectItem>
                                                        {closers.map(user => (
                                                            <SelectItem
                                                                key={user.id}
                                                                value={user.id}
                                                                disabled={commissionSplits.some(s => s.role === 'Referrer' && s.userId === user.id)}
                                                            >
                                                                {user.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <p className="text-xs text-muted-foreground">
                                                    Receives 10% of each payment for the program duration (e.g., 6 months of recurring charges).
                                                </p>
                                            </div>

                                            <div className="border-t border-border/50" />

                                            {/* Referrer Section */}
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-2 w-2 rounded-full bg-green-500" />
                                                        <Label className="font-semibold">Referrer</Label>
                                                    </div>
                                                    <span className="text-xs text-muted-foreground">$100 flat reward</span>
                                                </div>
                                                <Select
                                                    value={commissionSplits.find(s => s.role === 'Referrer')?.userId || 'none'}
                                                    onValueChange={(userId) => {
                                                        if (userId === 'none') {
                                                            setCommissionSplits(prev => prev.filter(s => s.role !== 'Referrer'))
                                                        } else {
                                                            const existing = commissionSplits.find(s => s.role === 'Referrer')
                                                            if (existing) {
                                                                setCommissionSplits(prev => prev.map(s =>
                                                                    s.role === 'Referrer' ? { ...s, userId } : s
                                                                ))
                                                            } else {
                                                                // Use percentage: 0 to indicate flat rate, store actual amount elsewhere or use special handling
                                                                setCommissionSplits(prev => [...prev, { userId, role: 'Referrer', percentage: 0 }])
                                                            }
                                                        }
                                                    }}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select Referrer (optional)..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="none">None</SelectItem>
                                                        {closers.map(user => (
                                                            <SelectItem
                                                                key={user.id}
                                                                value={user.id}
                                                                disabled={commissionSplits.some(s => s.role === 'Closer' && s.userId === user.id)}
                                                            >
                                                                {user.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <p className="text-xs text-muted-foreground">
                                                    Receives a one-time $100 bonus on their next payroll when the sale closes.
                                                </p>
                                            </div>

                                            {/* Summary */}
                                            {commissionSplits.length > 0 && (
                                                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                                                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Commission Summary</Label>
                                                    {commissionSplits.map((split, idx) => (
                                                        <div key={idx} className="flex items-center justify-between text-sm">
                                                            <span className="flex items-center gap-2">
                                                                <div className={cn(
                                                                    "h-2 w-2 rounded-full",
                                                                    split.role === 'Closer' ? 'bg-blue-500' : 'bg-green-500'
                                                                )} />
                                                                <span className="font-medium">{closers.find(c => c.id === split.userId)?.name || 'Unknown'}</span>
                                                                <span className="text-xs text-muted-foreground">({split.role})</span>
                                                            </span>
                                                            <span className="font-mono font-medium">
                                                                {split.role === 'Closer' ? '10% of gross' : '$100 flat'}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <DialogFooter>
                                            <Button onClick={() => setIsSplitDialogOpen(false)}>Done</Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            ) : (
                                <p className="text-xs text-muted-foreground">Enable the toggle to configure commission splits for this payment.</p>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className={cn("grid grid-cols-1 md:grid-cols-3 gap-6 transition-opacity duration-300", !isConfigValid && "opacity-50 pointer-events-none grayscale")}>
                <GeneratorCard
                    title="Pay in Full"
                    description="Generate a link for a single, up-front payment."
                    icon={<CreditCard className="w-10 h-10 text-blue-500 mb-2" />}
                    prices={oneTimePrices}
                    buttonLabel="Generate Full Payment Link"
                    config={config}
                />

                <CreateSplitPaymentDialog prices={oneTimePrices} coaches={coaches} globalConfig={config}>
                    <Card className="flex flex-col h-full border-2 border-border/50 hover:border-primary/20 transition-all duration-300 cursor-pointer group">
                        <CardHeader>
                            <div className="mb-2"><Split className="w-10 h-10 text-purple-500 mb-2" /></div>
                            <CardTitle className="text-xl">Custom Split Plan</CardTitle>
                            <CardDescription>Generate a custom installment plan (e.g. $1000 now, $1500 later).</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1">
                            <div className="h-full flex items-center justify-center text-muted-foreground text-sm border-2 border-dashed rounded-md bg-muted/10 group-hover:bg-muted/30 transition-colors py-8">
                                Click to configure amounts
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button className="w-full" variant="secondary">Configure Schedule</Button>
                        </CardFooter>
                    </Card>
                </CreateSplitPaymentDialog>

                <GeneratorCard
                    title="Monthly Recurring"
                    description="Generate a subscription link for monthly billing."
                    icon={<Repeat className="w-10 h-10 text-green-500 mb-2" />}
                    prices={recurringPrices}
                    buttonLabel="Generate Subscription Link"
                    config={config}
                />
            </div>
        </div>
    )
}

function GeneratorCard({
    title,
    description,
    icon,
    prices,
    buttonLabel,
    config
}: {
    title: string
    description: string
    icon: React.ReactNode
    prices: ProductPrice[]
    buttonLabel: string
    config: LinkConfig
}) {
    const [selectedProductId, setSelectedProductId] = useState<string>('')
    const [selectedPriceId, setSelectedPriceId] = useState<string>('')

    const [isLoading, setIsLoading] = useState(false)
    const [lastLink, setLastLink] = useState<string | null>(null)

    // Group prices by product
    const products = prices.reduce((acc, price) => {
        if (!acc[price.product_id]) {
            acc[price.product_id] = {
                name: price.product_name,
                prices: []
            }
        }
        acc[price.product_id].prices.push(price)
        return acc
    }, {} as Record<string, { name: string, prices: ProductPrice[] }>)

    // Get available prices for selected product
    const availablePrices = selectedProductId ? products[selectedProductId]?.prices || [] : []

    const handleGenerate = async () => {
        if (!selectedPriceId) return

        setIsLoading(true)
        setLastLink(null)

        try {
            // Find selected price details
            const selectedPrice = prices.find(p => p.id === selectedPriceId)
            if (!selectedPrice) return

            // Call Internal Action to create DB Ref
            const { id: refId, error: refError } = await createStandardPaymentRef(
                selectedPrice.id,
                selectedPrice.type === 'recurring' ? 'recurring' : 'one_time',
                selectedPrice.product_name,
                selectedPrice.unit_amount || 0, // Assuming amountInCents is selectedPrice.unit_amount
                {
                    coachId: config.coachId === 'tbd' ? undefined : config.coachId, // Kept config.coachId as per original, assuming new state vars are not available here
                    salesCloserId: config.salesCloserId, // Kept config.salesCloserId as per original
                    clientId: config.clientId, // Kept config.clientId as per original
                    leadId: config.leadId, // Kept config.leadId as per original
                    clientTypeId: config.clientTypeId, // Added clientTypeId from config
                    startDate: config.startDate ? config.startDate.toISOString() : undefined, // Kept config.startDate as per original
                    programTerm: config.programTerm, // Kept config.programTerm as per original
                    commissionSplits: config.commissionSplits // Added commissionSplits from config
                }
            )
            if (refError) {
                toast.error(refError)
                setIsLoading(false)
                return
            }

            // Create Link pointing to our internal custom payment page
            // Use NEXT_PUBLIC_PAYMENT_URL for pay subdomain (pay.mwfitnesscoaching.com)
            // Falls back to window.location.origin for local development
            const payBaseUrl = process.env.NEXT_PUBLIC_PAYMENT_URL || window.location.origin
            const paymentUrl = `${payBaseUrl}/${refId}`

            setLastLink(paymentUrl)
            toast.success('Payment link generated!')
            window.open(paymentUrl, '_blank') // Open in new tab
        } catch (error) {
            console.error(error)
            toast.error("An unexpected error occurred.")
        } finally {
            setIsLoading(false)
        }
    }

    const resetStandardForm = () => {
        setSelectedProductId('')
        setSelectedPriceId('')
        setLastLink(null)
        setIsLoading(false)
    }

    const copyToClipboard = () => {
        if (lastLink) {
            navigator.clipboard.writeText(lastLink)
            toast.success("Link copied to clipboard")
        }
    }

    const formatPrice = (amount: number | null, currency: string) => {
        if (amount === null) return 'N/A'
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency.toUpperCase(),
        }).format(amount / 100)
    }

    return (
        <Card className="flex flex-col h-full border-2 border-border/50 hover:border-primary/20 transition-all duration-300">
            <CardHeader>
                <div className="mb-2">{icon}</div>
                <CardTitle className="text-xl">{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 space-y-4">

                {/* Step 1: Select Product */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Select Product</label>
                    <Select
                        value={selectedProductId}
                        onValueChange={(val) => {
                            setSelectedProductId(val)
                            setSelectedPriceId('') // Reset price when product changes
                        }}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Choose a product..." />
                        </SelectTrigger>
                        <SelectContent>
                            {Object.entries(products).length === 0 ? (
                                <div className="p-2 text-sm text-center text-muted-foreground">No products found.</div>
                            ) : (
                                Object.entries(products)
                                    .sort(([, a], [, b]) => {
                                        // Sort by lowest price
                                        const minA = Math.min(...a.prices.map(p => p.unit_amount || 0))
                                        const minB = Math.min(...b.prices.map(p => p.unit_amount || 0))
                                        return minA - minB
                                    })
                                    .map(([prodId, { name }]) => (
                                        <SelectItem key={prodId} value={prodId}>
                                            {name}
                                        </SelectItem>
                                    ))
                            )}
                        </SelectContent>
                    </Select>
                </div>

                {/* Step 2: Select Price Option (Only show if product selected) */}
                <div className="space-y-2">
                    <label className={cn("text-sm font-medium text-muted-foreground transition-opacity", !selectedProductId && "opacity-50")}>
                        Select Price Option
                    </label>
                    <Select
                        value={selectedPriceId}
                        onValueChange={setSelectedPriceId}
                        disabled={!selectedProductId}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder={!selectedProductId ? "Select product first" : "Choose a price..."} />
                        </SelectTrigger>
                        <SelectContent>
                            {availablePrices.map((price) => (
                                <SelectItem key={price.id} value={price.id}>
                                    <span className="font-medium mr-2">
                                        {formatPrice(price.unit_amount, price.currency)}
                                    </span>
                                    {price.recurring && (
                                        <span className="text-muted-foreground text-xs">
                                            /{price.recurring.interval}
                                        </span>
                                    )}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {lastLink && (
                    <div className="p-3 bg-muted/50 rounded-md border border-border text-sm break-all animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-xs uppercase text-muted-foreground">Generated Link</span>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={copyToClipboard}>
                                <Copy className="h-3 w-3" />
                            </Button>
                        </div>
                        <a href={lastLink} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                            {lastLink.substring(0, 30)}...
                            <ExternalLink className="h-3 w-3" />
                        </a>
                    </div>
                )}
            </CardContent>
            <CardFooter>
                <Button
                    className="w-full"
                    onClick={handleGenerate}
                    disabled={!selectedPriceId || isLoading}
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Generating...
                        </>
                    ) : (
                        buttonLabel
                    )}
                </Button>
            </CardFooter>
        </Card>
    )
}
