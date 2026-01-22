'use client'

import { Badge } from '@/components/ui/badge'
import { ClientTag } from '@/types/client'
import { cn } from '@/lib/utils'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip'

interface ClientTagBadgesProps {
    tags: ClientTag[]
    maxVisible?: number
    size?: 'sm' | 'default'
    onClick?: (tag: ClientTag) => void
}

const TAG_COLORS: Record<string, string> = {
    gray: 'bg-gray-500/15 text-gray-500 border-gray-500/20',
    red: 'bg-red-500/15 text-red-500 border-red-500/20',
    amber: 'bg-amber-500/15 text-amber-600 border-amber-500/20',
    yellow: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/20',
    green: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/20',
    blue: 'bg-blue-500/15 text-blue-500 border-blue-500/20',
    purple: 'bg-purple-500/15 text-purple-500 border-purple-500/20',
    pink: 'bg-pink-500/15 text-pink-500 border-pink-500/20',
    orange: 'bg-orange-500/15 text-orange-500 border-orange-500/20',
}

export function ClientTagBadges({ tags, maxVisible = 2, size = 'default', onClick }: ClientTagBadgesProps) {
    if (!tags || tags.length === 0) {
        return <span className="text-muted-foreground text-sm">—</span>
    }

    const visibleTags = tags.slice(0, maxVisible)
    const hiddenTags = tags.slice(maxVisible)
    const hasMore = hiddenTags.length > 0

    const sizeClasses = size === 'sm' ? 'text-[10px] px-1.5 py-0' : 'text-xs px-2 py-0.5'

    return (
        <TooltipProvider>
            <div className="flex items-center gap-1 flex-wrap">
                {visibleTags.map((tag) => (
                    <Badge
                        key={tag.id}
                        variant="secondary"
                        className={cn(
                            sizeClasses,
                            TAG_COLORS[tag.color] || TAG_COLORS.gray,
                            onClick && 'cursor-pointer hover:opacity-80'
                        )}
                        onClick={(e) => {
                            if (onClick) {
                                e.stopPropagation()
                                onClick(tag)
                            }
                        }}
                    >
                        {tag.name}
                    </Badge>
                ))}
                {hasMore && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Badge
                                variant="secondary"
                                className={cn(sizeClasses, 'bg-muted text-muted-foreground')}
                            >
                                +{hiddenTags.length}
                            </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                            <div className="flex flex-col gap-1">
                                {hiddenTags.map((tag) => (
                                    <span key={tag.id}>{tag.name}</span>
                                ))}
                            </div>
                        </TooltipContent>
                    </Tooltip>
                )}
            </div>
        </TooltipProvider>
    )
}

// Single tag badge for use elsewhere
export function TagBadge({ tag, size = 'default', onClick }: { tag: ClientTag; size?: 'sm' | 'default'; onClick?: () => void }) {
    const sizeClasses = size === 'sm' ? 'text-[10px] px-1.5 py-0' : 'text-xs px-2 py-0.5'

    return (
        <Badge
            variant="secondary"
            className={cn(
                sizeClasses,
                TAG_COLORS[tag.color] || TAG_COLORS.gray,
                onClick && 'cursor-pointer hover:opacity-80'
            )}
            onClick={onClick}
        >
            {tag.name}
        </Badge>
    )
}

// Color options for tag creation/editing
export const TAG_COLOR_OPTIONS = [
    { value: 'gray', label: 'Gray' },
    { value: 'red', label: 'Red' },
    { value: 'amber', label: 'Amber' },
    { value: 'green', label: 'Green' },
    { value: 'blue', label: 'Blue' },
    { value: 'purple', label: 'Purple' },
    { value: 'pink', label: 'Pink' },
    { value: 'orange', label: 'Orange' },
]
