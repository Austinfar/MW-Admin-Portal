'use client'

import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { ChevronUp, MessageCircle, Eye, User } from 'lucide-react'
import { toast } from 'sonner'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

import { toggleVote } from '@/lib/actions/feature-requests'
import {
    STATUS_CONFIG,
    CATEGORY_CONFIG,
    TYPE_CONFIG,
    type FeatureRequest,
} from '@/types/roadmap'
import { cn } from '@/lib/utils'

interface RequestCardProps {
    request: FeatureRequest
    onClick?: () => void
    onVoteChange?: () => void
    compact?: boolean
    isDragging?: boolean
}

export function RequestCard({
    request,
    onClick,
    onVoteChange,
    compact = false,
    isDragging = false,
}: RequestCardProps) {
    const [isVoting, setIsVoting] = useState(false)
    const [localVoteCount, setLocalVoteCount] = useState(request.vote_count)
    const [localHasVoted, setLocalHasVoted] = useState(request.has_voted || false)

    const statusConfig = STATUS_CONFIG[request.status]
    const categoryConfig = CATEGORY_CONFIG[request.category]
    const typeConfig = TYPE_CONFIG[request.type]

    const handleVote = async (e: React.MouseEvent) => {
        e.stopPropagation()
        if (isVoting) return

        setIsVoting(true)
        // Optimistic update
        setLocalHasVoted(!localHasVoted)
        setLocalVoteCount(prev => localHasVoted ? prev - 1 : prev + 1)

        try {
            const result = await toggleVote(request.id)
            if (result.error) {
                // Revert on error
                setLocalHasVoted(localHasVoted)
                setLocalVoteCount(request.vote_count)
                toast.error(result.error)
            } else {
                setLocalVoteCount(result.voteCount)
                setLocalHasVoted(result.voted)
                onVoteChange?.()
            }
        } catch (error) {
            // Revert on error
            setLocalHasVoted(localHasVoted)
            setLocalVoteCount(request.vote_count)
            toast.error('Failed to vote')
        } finally {
            setIsVoting(false)
        }
    }

    const submitterInitials = request.submitter?.name
        ?.split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase() || '?'

    if (compact) {
        return (
            <Card
                className={cn(
                    "cursor-pointer hover:bg-accent/50 transition-colors",
                    isDragging && "opacity-50 rotate-2 shadow-lg"
                )}
                onClick={onClick}
            >
                <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                        {/* Vote Button */}
                        <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                                "flex-col h-auto py-1 px-2 min-w-[40px]",
                                localHasVoted && "text-neon-green"
                            )}
                            onClick={handleVote}
                            disabled={isVoting}
                        >
                            <ChevronUp className="h-4 w-4" />
                            <span className="text-xs font-medium">{localVoteCount}</span>
                        </Button>

                        <div className="flex-1 min-w-0">
                            <div className="flex items-start gap-2">
                                <span className="text-lg">{typeConfig.icon}</span>
                                <h4 className="font-medium text-sm line-clamp-1">{request.title}</h4>
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                <Badge
                                    variant="outline"
                                    className={cn("text-[10px] px-1.5 py-0", statusConfig.color, statusConfig.bgColor, statusConfig.borderColor)}
                                >
                                    {statusConfig.label}
                                </Badge>
                                {request.target_quarter && (
                                    <span>{request.target_quarter}</span>
                                )}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card
            className={cn(
                "cursor-pointer hover:bg-accent/50 transition-colors",
                isDragging && "opacity-50 rotate-1 shadow-lg"
            )}
            onClick={onClick}
        >
            <CardContent className="p-4">
                <div className="flex gap-4">
                    {/* Vote Button */}
                    <div className="flex flex-col items-center">
                        <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                                "flex-col h-auto py-2 px-3",
                                localHasVoted && "text-neon-green bg-neon-green/10"
                            )}
                            onClick={handleVote}
                            disabled={isVoting}
                        >
                            <ChevronUp className={cn("h-5 w-5", localHasVoted && "fill-current")} />
                            <span className="text-sm font-bold">{localVoteCount}</span>
                        </Button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-2">
                        {/* Title Row */}
                        <div className="flex items-start gap-2">
                            <span className="text-xl">{typeConfig.icon}</span>
                            <h3 className="font-semibold text-base leading-tight line-clamp-2">
                                {request.title}
                            </h3>
                        </div>

                        {/* Description Preview */}
                        <p className="text-sm text-muted-foreground line-clamp-2">
                            {request.description?.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 150)}
                        </p>

                        {/* Badges Row */}
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge
                                variant="outline"
                                className={cn("text-xs", statusConfig.color, statusConfig.bgColor, statusConfig.borderColor)}
                            >
                                {statusConfig.label}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                                {categoryConfig.icon} {categoryConfig.label}
                            </Badge>
                            {request.target_quarter && (
                                <Badge variant="outline" className="text-xs">
                                    {request.target_quarter}
                                </Badge>
                            )}
                            {request.tags.map(tag => (
                                <Badge key={tag} variant="outline" className="text-xs">
                                    {tag}
                                </Badge>
                            ))}
                        </div>

                        {/* Meta Row */}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            {/* Submitter */}
                            <div className="flex items-center gap-1.5">
                                <Avatar className="h-5 w-5">
                                    <AvatarImage src={request.submitter?.avatar_url || undefined} />
                                    <AvatarFallback className="text-[10px]">{submitterInitials}</AvatarFallback>
                                </Avatar>
                                <span>{request.submitter?.name || 'Unknown'}</span>
                            </div>

                            {/* Time */}
                            <span>
                                {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                            </span>

                            {/* Comments */}
                            {request.comment_count > 0 && (
                                <div className="flex items-center gap-1">
                                    <MessageCircle className="h-3.5 w-3.5" />
                                    <span>{request.comment_count}</span>
                                </div>
                            )}

                            {/* Watchers */}
                            {request.watcher_count > 0 && (
                                <div className="flex items-center gap-1">
                                    <Eye className="h-3.5 w-3.5" />
                                    <span>{request.watcher_count}</span>
                                </div>
                            )}

                            {/* Assigned */}
                            {request.assignee && (
                                <div className="flex items-center gap-1 text-neon-green">
                                    <User className="h-3.5 w-3.5" />
                                    <span>{request.assignee.name}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
