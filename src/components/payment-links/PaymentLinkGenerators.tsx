'use client'

import { useState } from 'react'
import { Check, Copy, CreditCard, ExternalLink, Loader2, Repeat, Split } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createPaymentLink, createStandardPaymentRef } from '@/lib/actions/stripe-actions'
import { CreateSplitPaymentDialog } from './CreateSplitPaymentDialog'

interface ProductPrice {
    id: string
    product_name: string
    unit_amount: number | null
    currency: string
    type: string // 'one_time' or 'recurring'
    recurring: { interval: string } | null
}

interface PaymentLinkGeneratorsProps {
    prices: ProductPrice[]
    isTestMode: boolean
}

export function PaymentLinkGenerators({ prices, isTestMode }: PaymentLinkGeneratorsProps) {
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
            />

            <CreateSplitPaymentDialog>
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
            />
        </div>
    )
}

function GeneratorCard({
    title,
    description,
    icon,
    prices,
    buttonLabel
}: {
    title: string
    description: string
    icon: React.ReactNode
    prices: ProductPrice[]
    buttonLabel: string
}) {
    const [selectedPriceId, setSelectedPriceId] = useState<string>('')
    const [isLoading, setIsLoading] = useState(false)
    const [lastLink, setLastLink] = useState<string | null>(null)

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
                selectedPrice.unit_amount || 0
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
                <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Select Product</label>
                    <Select value={selectedPriceId} onValueChange={setSelectedPriceId}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select a price..." />
                        </SelectTrigger>
                        <SelectContent>
                            {prices.length === 0 ? (
                                <div className="p-2 text-sm text-center text-muted-foreground">No matching prices found.</div>
                            ) : (
                                prices.map((price) => (
                                    <SelectItem key={price.id} value={price.id}>
                                        <span className="font-medium mr-2">{price.product_name}</span>
                                        <span className="text-muted-foreground">
                                            ({formatPrice(price.unit_amount, price.currency)})
                                        </span>
                                    </SelectItem>
                                ))
                            )}
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
