'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    Target,
    User,
    Wallet,
    Clock,
    AlertCircle,
    ChevronDown,
    ChevronUp,
    Globe,
    Megaphone
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface PreCallSummaryCardProps {
    metadata: Record<string, unknown> | null
    source: string | null
    coachName?: string | null
}

export function PreCallSummaryCard({ metadata, source, coachName }: PreCallSummaryCardProps) {
    const [showFullQuestionnaire, setShowFullQuestionnaire] = useState(false)

    if (!metadata) {
        return (
            <Card className="bg-zinc-900/60 border-zinc-800">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                        <Target className="h-4 w-4" />
                        Pre-Call Summary
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-zinc-500">No questionnaire data available</p>
                </CardContent>
            </Card>
        )
    }

    // Extract key fields from metadata
    const questionnaire = metadata.questionnaire as Record<string, unknown> | undefined
    const sourceDetail = metadata.source_detail as string | undefined
    const utmSource = metadata.utm_source as string | undefined
    const utmCampaign = metadata.utm_campaign as string | undefined
    const landingPage = metadata.landing_page_variant as string | undefined

    // Common questionnaire field mappings
    const primaryGoal = questionnaire?.primary_goal ||
                        questionnaire?.goal ||
                        questionnaire?.['What is your primary goal?'] ||
                        metadata.primary_goal ||
                        null

    const experience = questionnaire?.experience_level ||
                      questionnaire?.training_experience ||
                      questionnaire?.['How long have you been training?'] ||
                      metadata.experience_level ||
                      null

    const budget = questionnaire?.budget ||
                   questionnaire?.budget_range ||
                   questionnaire?.['What is your budget?'] ||
                   metadata.budget_range ||
                   null

    const timeline = questionnaire?.timeline ||
                    questionnaire?.urgency ||
                    questionnaire?.['When are you looking to start?'] ||
                    metadata.timeline ||
                    null

    const challenge = questionnaire?.biggest_challenge ||
                     questionnaire?.challenge ||
                     questionnaire?.['What is your biggest challenge?'] ||
                     metadata.biggest_challenge ||
                     null

    const commitment = questionnaire?.commitment_level ||
                      questionnaire?.commitment ||
                      metadata.commitment_level ||
                      null

    // Build source string
    const sourceInfo = []
    if (utmSource) sourceInfo.push(utmSource)
    if (utmCampaign) sourceInfo.push(utmCampaign)
    if (!sourceInfo.length && sourceDetail) sourceInfo.push(sourceDetail)
    if (!sourceInfo.length && source) sourceInfo.push(source)
    const sourceString = sourceInfo.join(' / ') || 'Direct'

    // Get all questionnaire entries for expanded view
    const allQuestionnaireEntries = questionnaire
        ? Object.entries(questionnaire).filter(([key]) =>
            !key.startsWith('_') && key !== 'id'
          )
        : []

    return (
        <Card className="bg-gradient-to-br from-zinc-900/80 to-zinc-900/40 border-zinc-800">
            <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                    <Target className="h-4 w-4 text-blue-500" />
                    Pre-Call Summary
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Source & Coach Row */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                            <Globe className="h-3 w-3" />
                            Source
                        </div>
                        <p className="text-sm font-medium text-zinc-200 truncate" title={sourceString}>
                            {sourceString}
                        </p>
                    </div>
                    <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                            <User className="h-3 w-3" />
                            Coach Preference
                        </div>
                        <p className="text-sm font-medium text-zinc-200">
                            {coachName || 'No preference'}
                        </p>
                    </div>
                </div>

                {/* Key Info Grid */}
                <div className="space-y-3">
                    {primaryGoal && (
                        <SummaryItem
                            icon={<Target className="h-3.5 w-3.5 text-green-500" />}
                            label="Primary Goal"
                            value={String(primaryGoal)}
                            highlight
                        />
                    )}

                    {experience && (
                        <SummaryItem
                            icon={<User className="h-3.5 w-3.5 text-blue-500" />}
                            label="Experience"
                            value={String(experience)}
                        />
                    )}

                    {budget && (
                        <SummaryItem
                            icon={<Wallet className="h-3.5 w-3.5 text-amber-500" />}
                            label="Budget"
                            value={String(budget)}
                        />
                    )}

                    {timeline && (
                        <SummaryItem
                            icon={<Clock className="h-3.5 w-3.5 text-purple-500" />}
                            label="Timeline"
                            value={String(timeline)}
                        />
                    )}

                    {challenge && (
                        <SummaryItem
                            icon={<AlertCircle className="h-3.5 w-3.5 text-red-500" />}
                            label="Biggest Challenge"
                            value={String(challenge)}
                            multiline
                        />
                    )}

                    {commitment && (
                        <SummaryItem
                            icon={<Megaphone className="h-3.5 w-3.5 text-cyan-500" />}
                            label="Commitment Level"
                            value={`${commitment}/10`}
                        />
                    )}
                </div>

                {/* Expandable Full Questionnaire */}
                {allQuestionnaireEntries.length > 0 && (
                    <div className="pt-2 border-t border-zinc-800">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowFullQuestionnaire(!showFullQuestionnaire)}
                            className="w-full justify-between text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 h-8"
                        >
                            <span className="text-xs">
                                {showFullQuestionnaire ? 'Hide' : 'View'} Full Questionnaire ({allQuestionnaireEntries.length} answers)
                            </span>
                            {showFullQuestionnaire ? (
                                <ChevronUp className="h-3.5 w-3.5" />
                            ) : (
                                <ChevronDown className="h-3.5 w-3.5" />
                            )}
                        </Button>

                        {showFullQuestionnaire && (
                            <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
                                {allQuestionnaireEntries.map(([key, value]) => (
                                    <div key={key} className="text-sm">
                                        <p className="text-xs text-zinc-500 mb-0.5">
                                            {formatQuestionKey(key)}
                                        </p>
                                        <p className="text-zinc-300 text-sm">
                                            {String(value) || '-'}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Empty state */}
                {!primaryGoal && !experience && !budget && !challenge && allQuestionnaireEntries.length === 0 && (
                    <p className="text-sm text-zinc-500 text-center py-2">
                        No questionnaire responses yet
                    </p>
                )}
            </CardContent>
        </Card>
    )
}

function SummaryItem({
    icon,
    label,
    value,
    highlight = false,
    multiline = false
}: {
    icon: React.ReactNode
    label: string
    value: string
    highlight?: boolean
    multiline?: boolean
}) {
    return (
        <div className={cn(
            "flex gap-2",
            multiline ? "flex-col" : "items-start"
        )}>
            <div className={cn(
                "flex items-center gap-1.5 text-xs text-zinc-500 shrink-0",
                multiline ? "" : "min-w-[100px]"
            )}>
                {icon}
                {label}
            </div>
            <p className={cn(
                "text-sm",
                highlight ? "font-medium text-green-400" : "text-zinc-300",
                multiline ? "bg-zinc-800/50 rounded p-2" : ""
            )}>
                {value}
            </p>
        </div>
    )
}

function formatQuestionKey(key: string): string {
    // Convert snake_case or camelCase to Title Case
    return key
        .replace(/_/g, ' ')
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase())
        .trim()
}
