'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FileText, Calendar, CheckCircle, HelpCircle } from 'lucide-react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'

interface LeadMetadataCardProps {
    metadata: Record<string, any> | null
    resolvedCoachName?: string | null
}

export function LeadMetadataCard({ metadata, resolvedCoachName }: LeadMetadataCardProps) {
    if (!metadata || Object.keys(metadata).length === 0) {
        return null
    }

    // Extract known fields for special display
    const { questionnaire, source_detail, last_submission, last_booking_responses, ...otherMetadata } = metadata

    return (
        <Card className="bg-card/40 border-primary/5 backdrop-blur-sm">
            <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5 text-neon-green" />
                    Additional Information
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Source Detail */}
                {source_detail && (
                    <div className="flex justify-between items-center border-b border-primary/5 pb-2">
                        <span className="text-sm text-muted-foreground">Detailed Source</span>
                        <span className="text-sm font-medium">{source_detail}</span>
                    </div>
                )}

                {/* Last Submission */}
                {last_submission && (
                    <div className="flex justify-between items-center border-b border-primary/5 pb-2">
                        <span className="text-sm text-muted-foreground">Last Interacton</span>
                        <span className="text-sm font-medium">
                            {new Date(last_submission).toLocaleDateString()}
                        </span>
                    </div>
                )}

                {/* Questionnaire Answers */}
                {questionnaire && Object.keys(questionnaire).length > 0 && (
                    <div className="pt-2">
                        <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-emerald-500" />
                            Questionnaire Answers
                        </h4>
                        <Accordion type="single" collapsible className="w-full">
                            <AccordionItem value="answers" className="border-zinc-800">
                                <AccordionTrigger className="py-2 text-sm text-zinc-400 hover:text-white">
                                    View {Object.keys(questionnaire).length} Answers
                                </AccordionTrigger>
                                <AccordionContent>
                                    <div className="space-y-3 pt-2">
                                        {Object.entries(questionnaire).map(([key, value]) => (
                                            <div key={key} className="bg-zinc-900/50 p-3 rounded-md text-sm">
                                                <div className="text-zinc-500 text-xs uppercase mb-1">{formatKey(key)}</div>
                                                <div className="text-zinc-200">{String(value)}</div>
                                            </div>
                                        ))}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </div>
                )}

                {/* Last Booking Responses (Cal.com) */}
                {last_booking_responses && Object.keys(last_booking_responses).length > 0 && (
                    <div className="pt-2">
                        <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-blue-500" />
                            Booking Form
                        </h4>
                        <Accordion type="single" collapsible className="w-full">
                            <AccordionItem value="booking" className="border-zinc-800">
                                <AccordionTrigger className="py-2 text-sm text-zinc-400 hover:text-white">
                                    View Form Data
                                </AccordionTrigger>
                                <AccordionContent>
                                    <div className="space-y-3 pt-2">
                                        {Object.entries(last_booking_responses).map(([key, value]) => (
                                            <div key={key} className="bg-zinc-900/50 p-3 rounded-md text-sm">
                                                <div className="text-zinc-500 text-xs uppercase mb-1">{formatKey(key)}</div>
                                                <div className="text-zinc-200">{String(value)}</div>
                                            </div>
                                        ))}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </div>
                )}

                {/* Other Metadata */}
                {otherMetadata && Object.keys(otherMetadata).length > 0 && (
                    <div className="pt-2">
                        <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                            <HelpCircle className="h-4 w-4 text-purple-500" />
                            Other Details
                        </h4>
                        <div className="grid grid-cols-2 gap-2">
                            {Object.entries(otherMetadata).map(([key, value]) => {
                                // Override display for coach_selected if we have a resolved name
                                const displayValue = (key === 'coach_selected' && resolvedCoachName)
                                    ? resolvedCoachName
                                    : String(value)

                                return (
                                    <div key={key} className="bg-zinc-900/30 p-2 rounded border border-zinc-800/50">
                                        <div className="text-zinc-500 text-[10px] uppercase truncate" title={key}>{formatKey(key)}</div>
                                        <div className="text-zinc-300 text-xs truncate" title={displayValue}>{displayValue}</div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

function formatKey(key: string): string {
    return key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim()
}
