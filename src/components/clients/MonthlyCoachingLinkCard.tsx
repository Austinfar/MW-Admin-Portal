'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calendar, Copy, ExternalLink, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { getCalLinkByType, type CalUserLink } from '@/lib/actions/cal-links'

interface MonthlyCoachingLinkCardProps {
    coachId: string | null
    coachName?: string | null
    clientName?: string
}

export function MonthlyCoachingLinkCard({
    coachId,
    coachName,
    clientName
}: MonthlyCoachingLinkCardProps) {
    const [link, setLink] = useState<CalUserLink | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchLink() {
            if (!coachId) {
                setLoading(false)
                return
            }

            try {
                const calLink = await getCalLinkByType(coachId, 'monthly_coaching')
                setLink(calLink)
            } catch (error) {
                console.error('Failed to fetch monthly coaching link:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchLink()
    }, [coachId])

    const copyLink = () => {
        if (!link?.url) return
        navigator.clipboard.writeText(link.url)
        toast.success('Monthly coaching link copied!')
    }

    const openLink = () => {
        if (!link?.url) return
        window.open(link.url, '_blank')
    }

    if (loading) {
        return (
            <Card className="bg-card/50 backdrop-blur-xl border-white/5">
                <CardContent className="flex items-center justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </CardContent>
            </Card>
        )
    }

    if (!coachId) {
        return (
            <Card className="bg-card/50 backdrop-blur-xl border-white/5 border-dashed">
                <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        Monthly Check-in
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">
                        No coach assigned. Assign a coach to enable monthly check-in scheduling.
                    </p>
                </CardContent>
            </Card>
        )
    }

    if (!link) {
        return (
            <Card className="bg-card/50 backdrop-blur-xl border-white/5 border-dashed">
                <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        Monthly Check-in
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">
                        {coachName || 'The assigned coach'} hasn&apos;t set up their monthly coaching calendar yet.
                    </p>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="bg-card/50 backdrop-blur-xl border-white/5 hover:border-primary/20 transition-all duration-300 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]">
            <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary" />
                    Monthly Check-in
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                    Share this link with {clientName || 'the client'} to schedule their monthly coaching call with {coachName || 'their coach'}.
                </p>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 bg-white/5 border-white/10 hover:bg-white/10"
                        onClick={copyLink}
                    >
                        <Copy className="w-3.5 h-3.5 mr-2" />
                        Copy Link
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="bg-white/5 border-white/10 hover:bg-white/10"
                        onClick={openLink}
                    >
                        <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}
