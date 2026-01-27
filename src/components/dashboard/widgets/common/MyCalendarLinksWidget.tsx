'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calendar, Copy, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { getMyCalLinks, type CalUserLink } from '@/lib/actions/cal-links'
import { buildBookingUrl } from '@/lib/cal/utils'

interface MyCalendarLinksWidgetProps {
    delay?: number
}

export function MyCalendarLinksWidget({ delay = 0 }: MyCalendarLinksWidgetProps) {
    const [links, setLinks] = useState<CalUserLink[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchLinks() {
            try {
                const calLinks = await getMyCalLinks()
                setLinks(calLinks)
            } catch (error) {
                console.error('Failed to fetch calendar links:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchLinks()
    }, [])

    const copyLink = (link: CalUserLink) => {
        // For consult links, append coach-driven source
        const url = link.link_type === 'consult'
            ? buildBookingUrl(link.url, 'coach-driven')
            : link.url

        navigator.clipboard.writeText(url)
        toast.success(`${link.display_name || 'Calendar'} link copied!`)
    }

    const getLinkLabel = (linkType: string): string => {
        switch (linkType) {
            case 'consult':
                return 'Coaching Consult'
            case 'monthly_coaching':
                return 'Monthly Check-in'
            default:
                return linkType
        }
    }

    if (loading) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: delay * 0.1 }}
            >
                <Card className="bg-card/50 backdrop-blur-sm border-primary/10">
                    <CardContent className="flex items-center justify-center py-8">
                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </CardContent>
                </Card>
            </motion.div>
        )
    }

    if (links.length === 0) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: delay * 0.1 }}
            >
                <Card className="bg-card/50 backdrop-blur-sm border-primary/10 border-dashed">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            My Calendar Links
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">
                            No calendar links configured. Contact admin to set up your booking calendars.
                        </p>
                    </CardContent>
                </Card>
            </motion.div>
        )
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
                duration: 0.4,
                delay: delay * 0.1,
                ease: [0.25, 0.46, 0.45, 0.94]
            }}
        >
            <Card className="bg-card/50 backdrop-blur-sm border-primary/10">
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        My Calendar Links
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        {links.map((link, index) => (
                            <motion.div
                                key={link.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: (delay * 0.1) + (index * 0.05) }}
                            >
                                <Button
                                    variant="ghost"
                                    className="w-full justify-between p-3 h-auto hover:bg-white/5 border border-transparent hover:border-primary/20"
                                    onClick={() => copyLink(link)}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-full bg-primary/10">
                                            <Calendar className="h-4 w-4 text-primary" />
                                        </div>
                                        <div className="text-left">
                                            <span className="text-sm font-medium block">
                                                {link.display_name || getLinkLabel(link.link_type)}
                                            </span>
                                            {link.link_type === 'consult' && (
                                                <span className="text-xs text-muted-foreground">
                                                    For your own leads
                                                </span>
                                            )}
                                            {link.link_type === 'monthly_coaching' && (
                                                <span className="text-xs text-muted-foreground">
                                                    Share with clients
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <Copy className="h-4 w-4 text-muted-foreground" />
                                </Button>
                            </motion.div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    )
}
