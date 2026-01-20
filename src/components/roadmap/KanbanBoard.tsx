'use client'

import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import {
    DndContext,
    DragEndEvent,
    DragOverlay,
    DragStartEvent,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core'
import {
    SortableContext,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { toast } from 'sonner'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

import { KanbanColumn } from './KanbanColumn'
import { RequestCard } from './RequestCard'

import { getFeatureRequests, updateFeatureRequest } from '@/lib/actions/feature-requests'
import {
    STATUS_CONFIG,
    type FeatureRequest,
    type Milestone,
    type RequestStatus,
} from '@/types/roadmap'

interface KanbanBoardProps {
    milestones: Milestone[]
    isSuperAdmin: boolean
}

type ColumnId = 'planned' | 'in_progress' | 'completed'

const KANBAN_COLUMNS: { id: ColumnId; status: RequestStatus; title: string }[] = [
    { id: 'planned', status: 'planned', title: 'Planned' },
    { id: 'in_progress', status: 'in_progress', title: 'In Progress' },
    { id: 'completed', status: 'completed', title: 'Recently Completed' },
]

export function KanbanBoard({ milestones, isSuperAdmin }: KanbanBoardProps) {
    const [columns, setColumns] = useState<Record<ColumnId, FeatureRequest[]>>({
        planned: [],
        in_progress: [],
        completed: [],
    })
    const [isLoading, setIsLoading] = useState(true)
    const [activeRequest, setActiveRequest] = useState<FeatureRequest | null>(null)

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    )

    useEffect(() => {
        loadRequests()
    }, [])

    const loadRequests = async () => {
        setIsLoading(true)
        try {
            const [plannedRes, inProgressRes, completedRes] = await Promise.all([
                getFeatureRequests({ status: 'planned' }, { field: 'priority_score', direction: 'desc' }, { page: 1, limit: 50 }),
                getFeatureRequests({ status: 'in_progress' }, { field: 'priority_score', direction: 'desc' }, { page: 1, limit: 50 }),
                getFeatureRequests({ status: 'completed' }, { field: 'updated_at', direction: 'desc' }, { page: 1, limit: 10 }),
            ])

            setColumns({
                planned: plannedRes.data,
                in_progress: inProgressRes.data,
                completed: completedRes.data,
            })
        } catch (error) {
            console.error('Error loading kanban:', error)
            toast.error('Failed to load roadmap')
        } finally {
            setIsLoading(false)
        }
    }

    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event
        const request = Object.values(columns)
            .flat()
            .find(r => r.id === active.id)
        setActiveRequest(request || null)
    }

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event
        setActiveRequest(null)

        if (!over || !isSuperAdmin) return

        const activeId = active.id as string
        const overId = over.id as string

        // Find which column the item came from
        let sourceColumn: ColumnId | null = null
        let sourceRequest: FeatureRequest | null = null

        for (const [colId, requests] of Object.entries(columns)) {
            const found = requests.find(r => r.id === activeId)
            if (found) {
                sourceColumn = colId as ColumnId
                sourceRequest = found
                break
            }
        }

        if (!sourceColumn || !sourceRequest) return

        // Determine target column (could be dropped on column itself or another card)
        let targetColumn: ColumnId | null = null

        if (KANBAN_COLUMNS.some(c => c.id === overId)) {
            targetColumn = overId as ColumnId
        } else {
            // Dropped on a card - find which column that card is in
            for (const [colId, requests] of Object.entries(columns)) {
                if (requests.some(r => r.id === overId)) {
                    targetColumn = colId as ColumnId
                    break
                }
            }
        }

        if (!targetColumn || sourceColumn === targetColumn) return

        // Optimistically update UI
        const newSourceRequests = columns[sourceColumn].filter(r => r.id !== activeId)
        const updatedRequest = { ...sourceRequest, status: KANBAN_COLUMNS.find(c => c.id === targetColumn)!.status }
        const newTargetRequests = [updatedRequest, ...columns[targetColumn]]

        setColumns(prev => ({
            ...prev,
            [sourceColumn!]: newSourceRequests,
            [targetColumn!]: newTargetRequests,
        }))

        // Update on server
        try {
            const result = await updateFeatureRequest({
                id: activeId,
                status: KANBAN_COLUMNS.find(c => c.id === targetColumn)!.status,
            })

            if (result.error) {
                toast.error(result.error)
                // Revert
                loadRequests()
            } else {
                toast.success(`Moved to ${KANBAN_COLUMNS.find(c => c.id === targetColumn)!.title}`)
            }
        } catch (error) {
            toast.error('Failed to update status')
            loadRequests()
        }
    }

    if (isLoading) {
        return (
            <div className="flex justify-center items-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {KANBAN_COLUMNS.map((column) => {
                    const columnRequests = columns[column.id]
                    const statusConfig = STATUS_CONFIG[column.status]

                    return (
                        <KanbanColumn
                            key={column.id}
                            id={column.id}
                            title={column.title}
                            count={columnRequests.length}
                            statusConfig={statusConfig}
                            requests={columnRequests}
                            isSuperAdmin={isSuperAdmin}
                        />
                    )
                })}
            </div>

            <DragOverlay>
                {activeRequest && (
                    <RequestCard
                        request={activeRequest}
                        compact
                        isDragging
                    />
                )}
            </DragOverlay>
        </DndContext>
    )
}
