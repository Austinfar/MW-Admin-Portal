'use client'

import { Check, Circle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface LeadJourneyStepperProps {
    metadata: {
        current_step?: string
        questionnaire_completed_at?: string
        coach_selected?: string
        consultation_scheduled_for?: string
        booking_completed_at?: string
        questionnaire?: any
    } | null
    status: string
    coachName?: string | null
}

export function LeadJourneyStepper({ metadata, status, coachName }: LeadJourneyStepperProps) {
    // Define steps
    const steps = [
        {
            id: 'contact',
            label: 'Contact Info',
            description: 'Lead submitted contact details',
            isCompleted: true // Always complete if lead exists
        },
        {
            id: 'coach_selection',
            label: 'Coach Selection',
            description: coachName ? `Selected: ${coachName}` : (metadata?.coach_selected ? `Selected: ${metadata.coach_selected}` : 'Coach not selected yet'),
            isCompleted: !!metadata?.coach_selected
        },
        {
            id: 'call_booking',
            label: 'Consult Scheduled',
            description: metadata?.consultation_scheduled_for || metadata?.booking_completed_at ? 'Call scheduled' : 'No call booked yet',
            isCompleted: !!metadata?.consultation_scheduled_for || !!metadata?.booking_completed_at
        },
        {
            id: 'questionnaire',
            label: 'Questionnaire',
            description: metadata?.questionnaire_completed_at ? 'Completed' : 'Pending completion',
            isCompleted: !!metadata?.questionnaire_completed_at || (metadata?.questionnaire && Object.keys(metadata.questionnaire).length > 0)
        }
    ]

    // Determine current active step index (for highlighting)
    const activeStepIndex = steps.findIndex(step => !step.isCompleted)
    const finalStepIndex = activeStepIndex === -1 ? steps.length : activeStepIndex

    return (
        <div className="w-full py-4">
            <div className="relative flex items-center justify-between w-full">
                {/* Connecting Line - Background */}
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-zinc-800 rounded-full -z-10" />

                {/* Connecting Line - Progress */}
                <div
                    className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-neon-green/50 rounded-full -z-10 transition-all duration-500"
                    style={{ width: `${(finalStepIndex / (steps.length - 1)) * 100}%` }}
                />

                {steps.map((step, index) => {
                    const isCompleted = step.isCompleted
                    const isActive = index === finalStepIndex

                    return (
                        <div key={step.id} className="flex flex-col items-center group">
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div
                                            className={cn(
                                                "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 bg-background",
                                                isCompleted
                                                    ? "bg-neon-green border-neon-green text-black shadow-[0_0_10px_rgba(34,197,94,0.4)]"
                                                    : isActive
                                                        ? "border-neon-green text-neon-green bg-black"
                                                        : "border-zinc-700 text-zinc-500 bg-zinc-900"
                                            )}
                                        >
                                            {isCompleted ? (
                                                <Check className="w-5 h-5 font-bold" />
                                            ) : isActive ? (
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                            ) : (
                                                <span className="text-sm font-medium">{index + 1}</span>
                                            )}
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p className="font-semibold">{step.label}</p>
                                        <p className="text-xs text-muted-foreground">{step.description}</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>

                            <div className="mt-2 text-center">
                                <span className={cn(
                                    "text-xs font-medium block transition-colors duration-300",
                                    isCompleted || isActive ? "text-white" : "text-zinc-500"
                                )}>
                                    {step.label}
                                </span>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
