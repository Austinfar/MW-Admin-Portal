'use client'

import { useState } from 'react'
import { CalendarIcon, Check, Copy, CreditCard, ExternalLink, Loader2, Repeat, Split } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { createPaymentLink, createStandardPaymentRef } from '@/lib/actions/stripe-actions'
import { CreateSplitPaymentDialog } from './CreateSplitPaymentDialog'
import { cn } from '@/lib/utils'

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
    avatar_url: string | null
}

interface PaymentLinkGeneratorsProps {
    prices: ProductPrice[]
    isTestMode: boolean
    coaches: Coach[]
}

export function PaymentLinkGenerators({ prices, isTestMode, coaches }: PaymentLinkGeneratorsProps) {
    const oneTimePrices = prices.filter(p => p.type === 'one_time' && p.unit_amount !== null)
    const recurringPrices = prices.filter(p => p.type === 'recurring' && p.unit_amount !== null && p.recurring?.interval === 'month')

    // For "Split", we ideally look for products named "Split" or just allow any one-time price users might use for installments
    // For now, we'll reuse oneTimePrices but with a different visual context
    const splitPrices = oneTimePrices

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <GeneratorCard
                title="Pay in Full"
                description="Generate a link for a single, up-front payment."
                icon={<CreditCard className="w-10 h-10 text-blue-500 mb-2" />}
                prices={oneTimePrices}
                buttonLabel="Generate Full Payment Link"
                coaches={coaches}
            />

            <CreateSplitPaymentDialog prices={oneTimePrices} coaches={coaches}>
                <Card className="flex flex-col h-full border-2 border-border/50 hover:border-primary/20 transition-all duration-300 cursor-pointer group">
                    <CardHeader>
                        <div className="mb-2"><Split className="w-10 h-10 text-purple-500 mb-2" /></div>
                        <CardTitle className="text-xl">Custom Split Plan</CardTitle>
                        <CardDescription>Generate a custom installment plan (e.g. $1000 now, $1500 later).</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1">
                        <div className="h-full flex items-center justify-center text-muted-foreground text-sm border-2 border-dashed rounded-md bg-muted/10 group-hover:bg-muted/30 transition-colors py-8">
                            Click to configure dates & amounts
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
                coaches={coaches}
            />
        </div>
    )
}

function GeneratorCard({
    title,
    description,
    icon,
    prices,
    buttonLabel,
    coaches
}: {
    title: string
    description: string
    icon: React.ReactNode
    prices: ProductPrice[]
    buttonLabel: string
    coaches: Coach[]
}) {
    const [selectedProductId, setSelectedProductId] = useState<string>('')
    const [selectedPriceId, setSelectedPriceId] = useState<string>('')
    const [selectedCoachId, setSelectedCoachId] = useState<string>('tbd')
    const [startDate, setStartDate] = useState<Date | undefined>(new Date()) // Default to today

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
            const result = await createStandardPaymentRef(
                selectedPrice.id,
                selectedPrice.type === 'recurring' ? 'recurring' : 'one_time',
                selectedPrice.product_name,
                selectedPrice.unit_amount || 0,
                {
                    coachId: selectedCoachId === 'tbd' ? undefined : selectedCoachId,
                    startDate: startDate ? startDate.toISOString() : undefined
                }
            )

            if (result.error) {
                toast.error(result.error)
                return
            }

            if (result.id) {
                // Generate Local Link
                const appUrl = window.location.origin
                const localLink = `${appUrl}/pay/${result.id}`

                // Open in new tab
                window.open(localLink, '_blank')
                setLastLink(localLink)
                toast.success("Payment link generated and opened!")
            }
        } catch (error) {
            console.error(error)
            toast.error("An unexpected error occurred.")
        } finally {
            setIsLoading(false)
        }
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
                    <label className="text-sm font-medium text-muted-foreground">1. Select Product</label>
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
                                Object.entries(products).map(([prodId, { name }]) => (
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
                        2. Select Price Option
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

                {/* Step 3: Select Coach */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">3. Assign Coach (Optional)</label>
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

                {/* Step 4: Select Start Date */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">4. Start Date</label>
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
                    <p className="text-[0.65rem] text-muted-foreground">
                        For recurring plans, billing cycles will anchor to this day of the month after the initial payment.
                    </p>
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
