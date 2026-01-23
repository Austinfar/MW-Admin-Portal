'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Copy, ChevronDown, Calendar, User, Globe } from 'lucide-react'
import { toast } from 'sonner'
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { CalUserLink, CalUserLinkWithUser } from '@/lib/actions/cal-links'

// Utility to add source parameter to booking URL
function buildBookingUrl(baseUrl: string, source: 'company-driven' | 'coach-driven'): string {
    if (!baseUrl) return ''
    const separator = baseUrl.includes('?') ? '&' : '?'
    return `${baseUrl}${separator}source=${source}`
}

interface BookingLinksSectionProps {
    globalCalendarUrl: string | null
    userLinks: CalUserLink[]
    allConsultLinks: CalUserLinkWithUser[]
    currentUserJobTitle: string | null
}

export function BookingLinksSection({
    globalCalendarUrl,
    userLinks,
    allConsultLinks,
    currentUserJobTitle
}: BookingLinksSectionProps) {
    const [coachLinksOpen, setCoachLinksOpen] = useState(false)

    const copyLink = (url: string, label?: string) => {
        navigator.clipboard.writeText(url)
        toast.success(label ? `${label} link copied!` : 'Link copied to clipboard!')
    }

    const isSetter = currentUserJobTitle === 'setter'
    const isCoachOrCloser = ['coach', 'head_coach', 'closer'].includes(currentUserJobTitle || '')

    // Get user's consult link
    const userConsultLink = userLinks.find(l => l.link_type === 'consult')

    return (
        <div className="space-y-2">
            {/* Setter View: Global Calendar + All Coach Calendars */}
            {isSetter && (
                <>
                    {/* Global Team Calendar */}
                    {globalCalendarUrl && (
                        <Button
                            variant="outline"
                            className="w-full justify-between text-left bg-white/5 border-white/5 hover:bg-white/10 hover:text-white transition-all duration-300"
                            onClick={() => copyLink(
                                buildBookingUrl(globalCalendarUrl, 'company-driven'),
                                'Global calendar'
                            )}
                        >
                            <span className="flex items-center">
                                <Globe className="w-3.5 h-3.5 mr-2 text-blue-400" />
                                Global Team Calendar
                            </span>
                            <Copy className="w-3.5 h-3.5 text-gray-500" />
                        </Button>
                    )}

                    {/* Coach Calendars Dropdown */}
                    {allConsultLinks.length > 0 && (
                        <Collapsible open={coachLinksOpen} onOpenChange={setCoachLinksOpen}>
                            <CollapsibleTrigger asChild>
                                <Button
                                    variant="outline"
                                    className="w-full justify-between text-left bg-white/5 border-white/5 hover:bg-white/10 hover:text-white transition-all duration-300"
                                >
                                    <span className="flex items-center">
                                        <User className="w-3.5 h-3.5 mr-2 text-emerald-400" />
                                        Coach Calendars
                                        <span className="ml-2 text-xs text-gray-500">
                                            ({allConsultLinks.length})
                                        </span>
                                    </span>
                                    <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${coachLinksOpen ? 'rotate-180' : ''}`} />
                                </Button>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="mt-1 space-y-1">
                                {allConsultLinks.map(link => {
                                    const jobLabel = link.user?.job_title === 'head_coach'
                                        ? 'Head Coach'
                                        : link.user?.job_title === 'closer'
                                            ? 'Closer'
                                            : 'Coach'

                                    return (
                                        <Button
                                            key={link.id}
                                            variant="ghost"
                                            className="w-full justify-between text-left pl-8 py-2 h-auto bg-white/[0.02] hover:bg-white/5 text-sm"
                                            onClick={() => copyLink(
                                                buildBookingUrl(link.url, 'company-driven'),
                                                link.user?.name || 'Calendar'
                                            )}
                                        >
                                            <span className="flex items-center">
                                                <Calendar className="w-3 h-3 mr-2 text-gray-500" />
                                                <span>{link.user?.name || 'Unknown'}</span>
                                                <span className="ml-2 text-xs text-gray-600">
                                                    ({jobLabel})
                                                </span>
                                            </span>
                                            <Copy className="w-3 h-3 text-gray-600" />
                                        </Button>
                                    )
                                })}
                            </CollapsibleContent>
                        </Collapsible>
                    )}

                    {!globalCalendarUrl && allConsultLinks.length === 0 && (
                        <p className="text-xs text-gray-500 text-center py-2">
                            No booking links configured yet
                        </p>
                    )}
                </>
            )}

            {/* Coach/Closer View: Own Calendar Link */}
            {isCoachOrCloser && (
                <>
                    {userConsultLink ? (
                        <Button
                            variant="outline"
                            className="w-full justify-between text-left bg-white/5 border-white/5 hover:bg-white/10 hover:text-white transition-all duration-300"
                            onClick={() => copyLink(
                                buildBookingUrl(userConsultLink.url, 'coach-driven'),
                                'My booking'
                            )}
                        >
                            <span className="flex items-center">
                                <Copy className="w-3.5 h-3.5 mr-2 text-blue-400" />
                                Copy My Booking Link
                            </span>
                            <span className="text-xs text-gray-500">Self-booked lead</span>
                        </Button>
                    ) : (
                        <div className="text-center py-2">
                            <p className="text-xs text-gray-500">
                                No booking link configured
                            </p>
                            <p className="text-xs text-gray-600 mt-1">
                                Contact admin to set up your calendar
                            </p>
                        </div>
                    )}
                </>
            )}

            {/* Fallback for other roles or no role */}
            {!isSetter && !isCoachOrCloser && globalCalendarUrl && (
                <Button
                    variant="outline"
                    className="w-full justify-between text-left bg-white/5 border-white/5 hover:bg-white/10 hover:text-white transition-all duration-300"
                    onClick={() => copyLink(globalCalendarUrl, 'Booking')}
                >
                    <span className="flex items-center">
                        <Copy className="w-3.5 h-3.5 mr-2 text-blue-400" />
                        Copy Booking Link
                    </span>
                    <Copy className="w-3.5 h-3.5 text-gray-500" />
                </Button>
            )}
        </div>
    )
}
