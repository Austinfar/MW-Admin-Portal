'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'

import { RequestCard } from './RequestCard'

import type { FeatureRequest } from '@/types/roadmap'
import { cn } from '@/lib/utils'

interface KanbanColumnProps {
    id: string
    title: string
    count: number
    statusConfig: { label: string; color: string; bgColor: string; borderColor: string }
    requests: FeatureRequest[]
    isSuperAdmin: boolean
}

export function KanbanColumn({
    id,
    title,
    count,
    statusConfig,
    requests,
    isSuperAdmin,
}: KanbanColumnProps) {
    const { setNodeRef, isOver } = useDroppable({
        id,
    })

    return (
        <Card className={cn(
            "flex flex-col h-[600px] transition-colors",
            isOver && isSuperAdmin && "ring-2 ring-neon-green ring-offset-2 ring-offset-background"
        )}>
            <CardHeader className="flex-shrink-0 pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <span className={cn("w-2 h-2 rounded-full", statusConfig.bgColor.replace('/10', ''))} />
                        {title}
                    </CardTitle>
                    <Badge variant="secondary" className="text-xs">
                        {count}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0">
                <ScrollArea className="h-full px-4 pb-4">
                    <div
                        ref={setNodeRef}
                        className="space-y-2 min-h-[200px]"
                    >
                        <SortableContext
                            items={requests.map(r => r.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            {requests.map((request) => (
                                <SortableRequestCard
                                    key={request.id}
                                    request={request}
                                    disabled={!isSuperAdmin}
                                />
                            ))}
                        </SortableContext>

                        {requests.length === 0 && (
                            <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
                                No requests
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    )
}

function SortableRequestCard({
    request,
    disabled,
}: {
    request: FeatureRequest
    disabled: boolean
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: request.id,
        disabled,
    })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
        >
            <RequestCard
                request={request}
                compact
                isDragging={isDragging}
            />
        </div>
    )
}
