'use client'

import { useState } from 'react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { pauseSubscription } from '@/lib/actions/subscriptions'
import { toast } from 'sonner'
import { Loader2, Calendar, Clock } from 'lucide-react'
import type { FreezeOption } from '@/types/subscription'

interface PauseSubscriptionDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    subscriptionId: string
    clientId: string
    clientName: string
    onSuccess?: () => void
}

type PauseOptionValue = 'pause_at_period_end' | '1_week' | '2_weeks' | '1_month'

const PAUSE_OPTIONS: { value: PauseOptionValue; label: string; description: string }[] = [
    {
        value: 'pause_at_period_end',
        label: 'Pause at end of billing period',
        description: 'Subscription will pause after the current period ends. No refund issued.'
    },
    {
        value: '1_week',
        label: 'Freeze for 1 week',
        description: 'Pause immediately and extend subscription by 1 week when resumed.'
    },
    {
        value: '2_weeks',
        label: 'Freeze for 2 weeks',
        description: 'Pause immediately and extend subscription by 2 weeks when resumed.'
    },
    {
        value: '1_month',
        label: 'Freeze for 1 month',
        description: 'Pause immediately and extend subscription by 1 month when resumed.'
    },
]

export function PauseSubscriptionDialog({
    open,
    onOpenChange,
    subscriptionId,
    clientId,
    clientName,
    onSuccess
}: PauseSubscriptionDialogProps) {
    const [selectedOption, setSelectedOption] = useState<PauseOptionValue>('pause_at_period_end')
    const [isLoading, setIsLoading] = useState(false)

    const handleSubmit = async () => {
        setIsLoading(true)

        try {
            let freezeOption: FreezeOption

            if (selectedOption === 'pause_at_period_end') {
                freezeOption = { type: 'pause_at_period_end' }
            } else {
                freezeOption = {
                    type: 'immediate_freeze',
                    duration: selectedOption
                }
            }

            const result = await pauseSubscription(subscriptionId, clientId, freezeOption)

            if (result.success) {
                toast.success(
                    selectedOption === 'pause_at_period_end'
                        ? 'Subscription will pause at end of billing period'
                        : `Subscription frozen for ${selectedOption.replace('_', ' ')}`
                )
                onOpenChange(false)
                onSuccess?.()
            } else {
                toast.error(result.error || 'Failed to pause subscription')
            }
        } catch (error) {
            toast.error('An unexpected error occurred')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Pause Subscription</DialogTitle>
                    <DialogDescription>
                        Choose how to pause the subscription for {clientName}.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                    <RadioGroup
                        value={selectedOption}
                        onValueChange={(value) => setSelectedOption(value as PauseOptionValue)}
                        className="space-y-3"
                    >
                        {PAUSE_OPTIONS.map((option) => (
                            <div
                                key={option.value}
                                className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                                    selectedOption === option.value
                                        ? 'border-primary bg-primary/5'
                                        : 'border-white/10 hover:border-white/20'
                                }`}
                                onClick={() => setSelectedOption(option.value)}
                            >
                                <RadioGroupItem
                                    value={option.value}
                                    id={option.value}
                                    className="mt-0.5"
                                />
                                <div className="flex-1">
                                    <Label
                                        htmlFor={option.value}
                                        className="text-sm font-medium cursor-pointer flex items-center gap-2"
                                    >
                                        {option.value === 'pause_at_period_end' ? (
                                            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                        ) : (
                                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                        )}
                                        {option.label}
                                    </Label>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {option.description}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </RadioGroup>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isLoading}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isLoading}
                        className="bg-amber-600 hover:bg-amber-700"
                    >
                        {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Pause Subscription
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
