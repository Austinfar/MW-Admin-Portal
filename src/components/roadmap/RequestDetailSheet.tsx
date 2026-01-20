'use client'

import { useState, useEffect } from 'react'
import { formatDistanceToNow, format } from 'date-fns'
import { X, ChevronUp, Eye, EyeOff, MessageCircle, Clock, User, Link2, Tag, Calendar, Send, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { RichTextViewer } from './RichTextEditor'

import {
    toggleVote,
    toggleWatch,
    getComments,
    addComment,
    toggleCommentReaction,
    updateFeatureRequest,
    getStatusHistory,
    deleteFeatureRequest,
} from '@/lib/actions/feature-requests'
import {
    STATUS_CONFIG,
    CATEGORY_CONFIG,
    TYPE_CONFIG,
    PRIORITY_CONFIG,
    EFFORT_CONFIG,
    REACTION_EMOJIS,
    type FeatureRequest,
    type FeatureComment,
    type FeatureTag,
    type Milestone,
    type FeatureStatusHistory,
    type RequestStatus,
    type EffortEstimate,
} from '@/types/roadmap'
import { cn } from '@/lib/utils'

interface RequestDetailSheetProps {
    request: FeatureRequest | null
    onClose: () => void
    isSuperAdmin: boolean
    tags: FeatureTag[]
    milestones: Milestone[]
    onUpdate?: () => void
}

export function RequestDetailSheet({
    request,
    onClose,
    isSuperAdmin,
    tags,
    milestones,
    onUpdate,
}: RequestDetailSheetProps) {
    const [comments, setComments] = useState<FeatureComment[]>([])
    const [statusHistory, setStatusHistory] = useState<FeatureStatusHistory[]>([])
    const [isLoadingComments, setIsLoadingComments] = useState(false)
    const [newComment, setNewComment] = useState('')
    const [isSubmittingComment, setIsSubmittingComment] = useState(false)
    const [isUpdating, setIsUpdating] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)

    // Local state for optimistic updates
    const [localHasVoted, setLocalHasVoted] = useState(false)
    const [localVoteCount, setLocalVoteCount] = useState(0)
    const [localIsWatching, setLocalIsWatching] = useState(false)

    useEffect(() => {
        if (request) {
            setLocalHasVoted(request.has_voted || false)
            setLocalVoteCount(request.vote_count)
            setLocalIsWatching(request.is_watching || false)
            loadComments()
            if (isSuperAdmin) {
                loadStatusHistory()
            }
        }
    }, [request?.id])

    const loadComments = async () => {
        if (!request) return
        setIsLoadingComments(true)
        try {
            const data = await getComments(request.id)
            setComments(data)
        } catch (error) {
            console.error('Error loading comments:', error)
        } finally {
            setIsLoadingComments(false)
        }
    }

    const loadStatusHistory = async () => {
        if (!request) return
        try {
            const data = await getStatusHistory(request.id)
            setStatusHistory(data)
        } catch (error) {
            console.error('Error loading status history:', error)
        }
    }

    const handleVote = async () => {
        if (!request) return
        setLocalHasVoted(!localHasVoted)
        setLocalVoteCount(prev => localHasVoted ? prev - 1 : prev + 1)

        const result = await toggleVote(request.id)
        if (result.error) {
            setLocalHasVoted(localHasVoted)
            setLocalVoteCount(request.vote_count)
            toast.error(result.error)
        } else {
            setLocalVoteCount(result.voteCount)
            setLocalHasVoted(result.voted)
            onUpdate?.()
        }
    }

    const handleWatch = async () => {
        if (!request) return
        setLocalIsWatching(!localIsWatching)

        const result = await toggleWatch(request.id)
        if (result.error) {
            setLocalIsWatching(localIsWatching)
            toast.error(result.error)
        } else {
            setLocalIsWatching(result.watching)
        }
    }

    const handleSubmitComment = async () => {
        if (!request || !newComment.trim()) return
        setIsSubmittingComment(true)

        try {
            const result = await addComment(request.id, newComment)
            if (result.error) {
                toast.error(result.error)
            } else if (result.data) {
                setComments(prev => [...prev, result.data!])
                setNewComment('')
                toast.success('Comment added')
            }
        } catch (error) {
            toast.error('Failed to add comment')
        } finally {
            setIsSubmittingComment(false)
        }
    }

    const handleReaction = async (commentId: string, emoji: string) => {
        const result = await toggleCommentReaction(commentId, emoji)
        if (result.success) {
            setComments(prev =>
                prev.map(c =>
                    c.id === commentId ? { ...c, reactions: result.reactions } : c
                )
            )
        }
    }

    const handleStatusChange = async (newStatus: RequestStatus) => {
        if (!request) return
        setIsUpdating(true)
        try {
            const result = await updateFeatureRequest({ id: request.id, status: newStatus })
            if (result.error) {
                toast.error(result.error)
            } else {
                toast.success('Status updated')
                onUpdate?.()
                loadStatusHistory()
            }
        } finally {
            setIsUpdating(false)
        }
    }

    const handleMilestoneChange = async (milestoneId: string | null) => {
        if (!request) return
        setIsUpdating(true)
        try {
            const result = await updateFeatureRequest({
                id: request.id,
                milestone_id: milestoneId,
            })
            if (result.error) {
                toast.error(result.error)
            } else {
                toast.success('Milestone updated')
                onUpdate?.()
            }
        } finally {
            setIsUpdating(false)
        }
    }

    const handleEffortChange = async (effort: EffortEstimate | null) => {
        if (!request) return
        setIsUpdating(true)
        try {
            const result = await updateFeatureRequest({
                id: request.id,
                effort_estimate: effort,
            })
            if (result.error) {
                toast.error(result.error)
            } else {
                toast.success('Effort updated')
                onUpdate?.()
            }
        } finally {
            setIsUpdating(false)
        }
    }

    const handleDelete = async () => {
        if (!request) return
        setIsDeleting(true)
        try {
            const result = await deleteFeatureRequest(request.id)
            if (result.error) {
                toast.error(result.error)
            } else {
                toast.success('Request deleted')
                onClose()
                onUpdate?.()
            }
        } finally {
            setIsDeleting(false)
        }
    }

    if (!request) return null

    const statusConfig = STATUS_CONFIG[request.status]
    const categoryConfig = CATEGORY_CONFIG[request.category]
    const typeConfig = TYPE_CONFIG[request.type]
    const priorityConfig = PRIORITY_CONFIG[request.priority]

    return (
        <Sheet open={!!request} onOpenChange={() => onClose()}>
            <SheetContent className="w-full sm:max-w-xl overflow-hidden flex flex-col">
                <SheetHeader className="flex-shrink-0">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                                <span>{typeConfig.icon}</span>
                                <span>{typeConfig.label}</span>
                                <span>•</span>
                                <span>{categoryConfig.icon} {categoryConfig.label}</span>
                            </div>
                            <SheetTitle className="text-xl leading-tight">
                                {request.title}
                            </SheetTitle>
                        </div>
                    </div>
                </SheetHeader>

                <ScrollArea className="flex-1 -mx-6 px-6">
                    <div className="space-y-6 py-4">
                        {/* Actions Row */}
                        <div className="flex items-center gap-2">
                            <Button
                                variant={localHasVoted ? "default" : "outline"}
                                size="sm"
                                onClick={handleVote}
                                className={cn(localHasVoted && "bg-neon-green hover:bg-neon-green/90")}
                            >
                                <ChevronUp className="h-4 w-4 mr-1" />
                                {localVoteCount}
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleWatch}
                            >
                                {localIsWatching ? (
                                    <>
                                        <EyeOff className="h-4 w-4 mr-1" />
                                        Watching
                                    </>
                                ) : (
                                    <>
                                        <Eye className="h-4 w-4 mr-1" />
                                        Watch
                                    </>
                                )}
                            </Button>
                            <Badge
                                variant="outline"
                                className={cn(statusConfig.color, statusConfig.bgColor, statusConfig.borderColor)}
                            >
                                {statusConfig.label}
                            </Badge>
                            <Badge variant="outline" className={priorityConfig.color}>
                                {priorityConfig.label}
                            </Badge>
                        </div>

                        {/* Submitter Info */}
                        <div className="flex items-center gap-3 text-sm">
                            <Avatar className="h-8 w-8">
                                <AvatarImage src={request.submitter?.avatar_url || undefined} />
                                <AvatarFallback>
                                    {request.submitter?.name?.charAt(0) || '?'}
                                </AvatarFallback>
                            </Avatar>
                            <div>
                                <p className="font-medium">{request.submitter?.name || 'Unknown'}</p>
                                <p className="text-xs text-muted-foreground">
                                    Submitted {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                                </p>
                            </div>
                        </div>

                        <Separator />

                        {/* Description */}
                        <div className="space-y-2">
                            <h4 className="text-sm font-medium text-foreground">Description</h4>
                            <div className="bg-muted/30 rounded-lg p-4 border border-border/50">
                                {request.description ? (
                                    <RichTextViewer content={request.description} />
                                ) : (
                                    <p className="text-sm text-muted-foreground italic">No description provided</p>
                                )}
                            </div>
                        </div>

                        {/* Screenshots */}
                        {request.screenshot_urls.length > 0 && (
                            <div>
                                <h4 className="text-sm font-medium mb-2">Screenshots</h4>
                                <div className="flex flex-wrap gap-2">
                                    {request.screenshot_urls.map((url, i) => (
                                        <a
                                            key={i}
                                            href={url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="block"
                                        >
                                            <img
                                                src={url}
                                                alt={`Screenshot ${i + 1}`}
                                                className="h-20 w-auto rounded border hover:opacity-80 transition-opacity"
                                            />
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Admin Controls */}
                        {isSuperAdmin && (
                            <>
                                <Separator />
                                <div className="space-y-4 bg-muted/20 rounded-lg p-4 border border-border/50">
                                    <div className="flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full bg-neon-green" />
                                        <h4 className="text-sm font-medium">Admin Controls</h4>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        {/* Status */}
                                        <div className="space-y-2">
                                            <Label>Status</Label>
                                            <Select
                                                value={request.status}
                                                onValueChange={(v) => handleStatusChange(v as RequestStatus)}
                                                disabled={isUpdating}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                                                        <SelectItem key={key} value={key}>
                                                            <span className={config.color}>{config.label}</span>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {/* Milestone */}
                                        <div className="space-y-2">
                                            <Label>Milestone</Label>
                                            <Select
                                                value={request.milestone_id || 'none'}
                                                onValueChange={(v) => handleMilestoneChange(v === 'none' ? null : v)}
                                                disabled={isUpdating}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select milestone" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">No Milestone</SelectItem>
                                                    {milestones.map((m) => (
                                                        <SelectItem key={m.id} value={m.id}>
                                                            {m.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {/* Effort */}
                                        <div className="space-y-2">
                                            <Label>Effort Estimate</Label>
                                            <Select
                                                value={request.effort_estimate || 'none'}
                                                onValueChange={(v) => handleEffortChange(v === 'none' ? null : v as EffortEstimate)}
                                                disabled={isUpdating}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select effort" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">Not Estimated</SelectItem>
                                                    {Object.entries(EFFORT_CONFIG).map(([key, config]) => (
                                                        <SelectItem key={key} value={key}>
                                                            {config.label} - {config.description}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    {/* Delete Button */}
                                    <div className="pt-4 border-t">
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button
                                                    variant="destructive"
                                                    size="sm"
                                                    className="gap-2"
                                                    disabled={isDeleting}
                                                >
                                                    {isDeleting ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <Trash2 className="h-4 w-4" />
                                                    )}
                                                    Delete Request
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Delete Feature Request?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        This will permanently delete &quot;{request.title}&quot; and all associated comments, votes, and history. This action cannot be undone.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction
                                                        onClick={handleDelete}
                                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                    >
                                                        Delete
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </div>
                            </>
                        )}

                        <Separator />

                        {/* Comments */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <MessageCircle className="h-4 w-4" />
                                <h4 className="text-sm font-medium">
                                    Comments ({comments.length})
                                </h4>
                            </div>

                            {isLoadingComments ? (
                                <div className="flex justify-center py-8">
                                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {comments.map((comment) => (
                                        <CommentItem
                                            key={comment.id}
                                            comment={comment}
                                            onReaction={handleReaction}
                                        />
                                    ))}

                                    {comments.length === 0 && (
                                        <div className="flex flex-col items-center justify-center py-8 text-center bg-muted/20 rounded-lg border border-dashed border-border/50">
                                            <MessageCircle className="h-8 w-8 text-muted-foreground/50 mb-2" />
                                            <p className="text-sm text-muted-foreground">
                                                No comments yet
                                            </p>
                                            <p className="text-xs text-muted-foreground/70">
                                                Be the first to share your thoughts!
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Add Comment */}
                            <div className="space-y-2">
                                <Textarea
                                    placeholder="Add a comment..."
                                    value={newComment}
                                    onChange={(e) => setNewComment(e.target.value)}
                                    rows={3}
                                />
                                <Button
                                    size="sm"
                                    onClick={handleSubmitComment}
                                    disabled={!newComment.trim() || isSubmittingComment}
                                >
                                    {isSubmittingComment ? (
                                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                    ) : (
                                        <Send className="h-4 w-4 mr-1" />
                                    )}
                                    Post Comment
                                </Button>
                            </div>
                        </div>

                        {/* Status History (Admin only) */}
                        {isSuperAdmin && statusHistory.length > 0 && (
                            <>
                                <Separator />
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <Clock className="h-4 w-4" />
                                        <h4 className="text-sm font-medium">Status History</h4>
                                    </div>
                                    <div className="space-y-2">
                                        {statusHistory.map((entry) => (
                                            <div key={entry.id} className="text-xs text-muted-foreground flex items-center gap-2">
                                                <span className="text-foreground font-medium">
                                                    {entry.changer?.name || 'System'}
                                                </span>
                                                <span>changed status</span>
                                                {entry.old_status && (
                                                    <>
                                                        <span>from</span>
                                                        <Badge variant="outline" className="text-[10px] py-0">
                                                            {STATUS_CONFIG[entry.old_status]?.label}
                                                        </Badge>
                                                    </>
                                                )}
                                                <span>to</span>
                                                <Badge variant="outline" className="text-[10px] py-0">
                                                    {STATUS_CONFIG[entry.new_status]?.label}
                                                </Badge>
                                                <span>•</span>
                                                <span>{formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </ScrollArea>
            </SheetContent>
        </Sheet>
    )
}

function CommentItem({
    comment,
    onReaction,
}: {
    comment: FeatureComment
    onReaction: (commentId: string, emoji: string) => void
}) {
    return (
        <div className={cn(
            "p-3 rounded-lg",
            comment.is_admin_response
                ? "bg-neon-green/5 border border-neon-green/20"
                : "bg-muted/50"
        )}>
            <div className="flex items-start gap-3">
                <Avatar className="h-7 w-7">
                    <AvatarImage src={comment.user?.avatar_url || undefined} />
                    <AvatarFallback className="text-xs">
                        {comment.user?.name?.charAt(0) || '?'}
                    </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">
                            {comment.user?.name || 'Unknown'}
                        </span>
                        {comment.is_admin_response && (
                            <Badge variant="outline" className="text-[10px] py-0 text-neon-green border-neon-green/30">
                                Admin
                            </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                        </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{comment.content}</p>

                    {/* Reactions */}
                    <div className="flex items-center gap-1 mt-2">
                        {REACTION_EMOJIS.map((emoji) => {
                            const users = comment.reactions[emoji] || []
                            const hasReacted = users.length > 0 // Simplified for now
                            return (
                                <Button
                                    key={emoji}
                                    variant="ghost"
                                    size="sm"
                                    className={cn(
                                        "h-6 px-1.5 text-xs",
                                        hasReacted && "bg-muted"
                                    )}
                                    onClick={() => onReaction(comment.id, emoji)}
                                >
                                    {emoji}
                                    {users.length > 0 && (
                                        <span className="ml-1">{users.length}</span>
                                    )}
                                </Button>
                            )
                        })}
                    </div>
                </div>
            </div>
        </div>
    )
}
