'use client'

import { useState, useCallback, useEffect } from 'react'
import { Search, Filter, ArrowUpDown, Loader2 } from 'lucide-react'
import { useDebounce } from 'use-debounce'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuCheckboxItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import { RequestCard } from './RequestCard'
import { RequestDetailSheet } from './RequestDetailSheet'
import { ExportButton } from './ExportButton'

import { getFeatureRequests, getRoadmapStats } from '@/lib/actions/feature-requests'
import {
    STATUS_CONFIG,
    CATEGORY_CONFIG,
    TYPE_CONFIG,
    type FeatureRequest,
    type FeatureTag,
    type Milestone,
    type RequestListResult,
    type RequestStatus,
    type RequestCategory,
    type RequestSortOptions,
    type RoadmapStats,
} from '@/types/roadmap'

interface RequestListProps {
    initialData: RequestListResult
    tags: FeatureTag[]
    milestones: Milestone[]
    isSuperAdmin: boolean
    onStatsChange?: (stats: RoadmapStats) => void
    filterByUserId?: string
    showMyRequestsHeader?: boolean
}

export function RequestList({
    initialData,
    tags,
    milestones,
    isSuperAdmin,
    onStatsChange,
    filterByUserId,
    showMyRequestsHeader,
}: RequestListProps) {
    const [requests, setRequests] = useState<FeatureRequest[]>(initialData.data)
    const [totalCount, setTotalCount] = useState(initialData.total)
    const [page, setPage] = useState(1)
    const [isLoading, setIsLoading] = useState(false)
    const [hasMore, setHasMore] = useState(initialData.totalPages > 1)

    // Filters
    const [search, setSearch] = useState('')
    const [debouncedSearch] = useDebounce(search, 300)
    const [statusFilter, setStatusFilter] = useState<RequestStatus[]>([])
    const [categoryFilter, setCategoryFilter] = useState<RequestCategory[]>([])
    const [sort, setSort] = useState<RequestSortOptions>({ field: 'priority_score', direction: 'desc' })

    // Selected request for detail view
    const [selectedRequest, setSelectedRequest] = useState<FeatureRequest | null>(null)

    const fetchRequests = useCallback(async (reset = false) => {
        setIsLoading(true)
        try {
            const currentPage = reset ? 1 : page
            const result = await getFeatureRequests(
                {
                    search: debouncedSearch || undefined,
                    status: statusFilter.length > 0 ? statusFilter : undefined,
                    category: categoryFilter.length > 0 ? categoryFilter : undefined,
                    submitter_id: filterByUserId,
                },
                sort,
                { page: currentPage, limit: 20 }
            )

            if (reset) {
                setRequests(result.data)
                setPage(1)
            } else {
                setRequests(prev => [...prev, ...result.data])
            }
            setTotalCount(result.total)
            setHasMore(currentPage < result.totalPages)
        } catch (error) {
            console.error('Error fetching requests:', error)
        } finally {
            setIsLoading(false)
        }
    }, [debouncedSearch, statusFilter, categoryFilter, sort, page])

    // Refetch on filter changes
    useEffect(() => {
        fetchRequests(true)
    }, [debouncedSearch, statusFilter, categoryFilter, sort])

    const loadMore = () => {
        if (!isLoading && hasMore) {
            setPage(prev => prev + 1)
        }
    }

    useEffect(() => {
        if (page > 1) {
            fetchRequests(false)
        }
    }, [page])

    const handleRequestUpdate = async () => {
        // Refresh the list and stats after an update
        await fetchRequests(true)
        const newStats = await getRoadmapStats()
        onStatsChange?.(newStats)
    }

    const toggleStatusFilter = (status: RequestStatus) => {
        setStatusFilter(prev =>
            prev.includes(status)
                ? prev.filter(s => s !== status)
                : [...prev, status]
        )
    }

    const toggleCategoryFilter = (category: RequestCategory) => {
        setCategoryFilter(prev =>
            prev.includes(category)
                ? prev.filter(c => c !== category)
                : [...prev, category]
        )
    }

    return (
        <div className="space-y-4">
            {/* Filters Bar */}
            <div className="flex flex-col sm:flex-row gap-3">
                {/* Search */}
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search requests..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9"
                    />
                </div>

                {/* Status Filter */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="gap-2">
                            <Filter className="h-4 w-4" />
                            Status
                            {statusFilter.length > 0 && (
                                <span className="ml-1 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                                    {statusFilter.length}
                                </span>
                            )}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                            <DropdownMenuCheckboxItem
                                key={key}
                                checked={statusFilter.includes(key as RequestStatus)}
                                onCheckedChange={() => toggleStatusFilter(key as RequestStatus)}
                            >
                                <span className={config.color}>{config.label}</span>
                            </DropdownMenuCheckboxItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>

                {/* Category Filter */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="gap-2">
                            <Filter className="h-4 w-4" />
                            Category
                            {categoryFilter.length > 0 && (
                                <span className="ml-1 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                                    {categoryFilter.length}
                                </span>
                            )}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuLabel>Filter by Category</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                            <DropdownMenuCheckboxItem
                                key={key}
                                checked={categoryFilter.includes(key as RequestCategory)}
                                onCheckedChange={() => toggleCategoryFilter(key as RequestCategory)}
                            >
                                <span className="flex items-center gap-2">
                                    <span>{config.icon}</span>
                                    <span>{config.label}</span>
                                </span>
                            </DropdownMenuCheckboxItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>

                {/* Sort */}
                <Select
                    value={`${sort.field}-${sort.direction}`}
                    onValueChange={(value) => {
                        const [field, direction] = value.split('-') as [RequestSortOptions['field'], 'asc' | 'desc']
                        setSort({ field, direction })
                    }}
                >
                    <SelectTrigger className="w-[180px]">
                        <ArrowUpDown className="h-4 w-4 mr-2" />
                        <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="priority_score-desc">Top Voted</SelectItem>
                        <SelectItem value="vote_count-desc">Most Votes</SelectItem>
                        <SelectItem value="created_at-desc">Newest First</SelectItem>
                        <SelectItem value="created_at-asc">Oldest First</SelectItem>
                        <SelectItem value="updated_at-desc">Recently Updated</SelectItem>
                        <SelectItem value="comment_count-desc">Most Discussed</SelectItem>
                    </SelectContent>
                </Select>

                {/* Export */}
                <ExportButton filters={{
                    status: statusFilter.length > 0 ? statusFilter : undefined,
                    category: categoryFilter.length > 0 ? categoryFilter : undefined,
                    search: debouncedSearch || undefined,
                    submitter_id: filterByUserId,
                }} />
            </div>

            {/* Results Count */}
            <div className="text-sm text-muted-foreground">
                Showing {requests.length} of {totalCount} requests
            </div>

            {/* Request Cards */}
            <div className="space-y-3">
                {requests.map((request) => (
                    <RequestCard
                        key={request.id}
                        request={request}
                        onClick={() => setSelectedRequest(request)}
                        onVoteChange={handleRequestUpdate}
                    />
                ))}

                {requests.length === 0 && !isLoading && (
                    <div className="text-center py-12 text-muted-foreground">
                        <p>No requests found</p>
                        {(search || statusFilter.length > 0 || categoryFilter.length > 0) && (
                            <Button
                                variant="link"
                                onClick={() => {
                                    setSearch('')
                                    setStatusFilter([])
                                    setCategoryFilter([])
                                }}
                            >
                                Clear filters
                            </Button>
                        )}
                    </div>
                )}

                {isLoading && (
                    <div className="flex justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                )}

                {hasMore && !isLoading && (
                    <div className="flex justify-center pt-4">
                        <Button variant="outline" onClick={loadMore}>
                            Load More
                        </Button>
                    </div>
                )}
            </div>

            {/* Request Detail Sheet */}
            <RequestDetailSheet
                request={selectedRequest}
                onClose={() => setSelectedRequest(null)}
                isSuperAdmin={isSuperAdmin}
                tags={tags}
                milestones={milestones}
                onUpdate={handleRequestUpdate}
            />
        </div>
    )
}
