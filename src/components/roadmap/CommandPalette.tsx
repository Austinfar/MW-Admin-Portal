'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
    Command,
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
    CommandShortcut,
} from '@/components/ui/command'
import {
    Plus,
    Search,
    ChevronUp,
    Eye,
    LayoutGrid,
    Calendar,
    FileText,
    Settings,
    ArrowUp,
    ArrowDown,
} from 'lucide-react'

import { getFeatureRequests } from '@/lib/actions/feature-requests'
import type { FeatureRequest } from '@/types/roadmap'

interface CommandPaletteProps {
    onNewRequest?: () => void
    onFocusSearch?: () => void
    onNavigateToTab?: (tab: string) => void
}

export function CommandPalette({
    onNewRequest,
    onFocusSearch,
    onNavigateToTab,
}: CommandPaletteProps) {
    const [open, setOpen] = useState(false)
    const [search, setSearch] = useState('')
    const [requests, setRequests] = useState<FeatureRequest[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const router = useRouter()

    // Keyboard shortcut to open command palette
    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            // Ignore if typing in an input/textarea
            const target = e.target as HTMLElement
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                return
            }

            // Cmd/Ctrl + K to open palette
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                setOpen((open) => !open)
            }

            // N for new request
            if (e.key === 'n' && !e.metaKey && !e.ctrlKey && !e.altKey) {
                e.preventDefault()
                onNewRequest?.()
            }

            // / to focus search
            if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey) {
                e.preventDefault()
                onFocusSearch?.()
            }
        }

        document.addEventListener('keydown', down)
        return () => document.removeEventListener('keydown', down)
    }, [onNewRequest, onFocusSearch])

    // Search for requests when query changes
    useEffect(() => {
        if (!search || search.length < 2) {
            setRequests([])
            return
        }

        const searchRequests = async () => {
            setIsLoading(true)
            try {
                const result = await getFeatureRequests(
                    { search },
                    { field: 'priority_score', direction: 'desc' },
                    { page: 1, limit: 5 }
                )
                setRequests(result.data)
            } catch (error) {
                console.error('Error searching requests:', error)
            } finally {
                setIsLoading(false)
            }
        }

        const debounce = setTimeout(searchRequests, 300)
        return () => clearTimeout(debounce)
    }, [search])

    const handleSelectRequest = (requestId: string) => {
        setOpen(false)
        // Could emit an event or use a callback to open the request detail
        router.push(`/roadmap?request=${requestId}`)
    }

    const handleAction = (action: string) => {
        setOpen(false)
        switch (action) {
            case 'new':
                onNewRequest?.()
                break
            case 'search':
                onFocusSearch?.()
                break
            case 'roadmap':
            case 'timeline':
            case 'changelog':
            case 'requests':
                onNavigateToTab?.(action)
                break
        }
    }

    return (
        <CommandDialog open={open} onOpenChange={setOpen}>
            <CommandInput
                placeholder="Search requests or type a command..."
                value={search}
                onValueChange={setSearch}
            />
            <CommandList>
                <CommandEmpty>
                    {isLoading ? 'Searching...' : 'No results found.'}
                </CommandEmpty>

                {/* Quick Actions */}
                <CommandGroup heading="Actions">
                    <CommandItem onSelect={() => handleAction('new')}>
                        <Plus className="mr-2 h-4 w-4" />
                        <span>New Request</span>
                        <CommandShortcut>N</CommandShortcut>
                    </CommandItem>
                    <CommandItem onSelect={() => handleAction('search')}>
                        <Search className="mr-2 h-4 w-4" />
                        <span>Search Requests</span>
                        <CommandShortcut>/</CommandShortcut>
                    </CommandItem>
                </CommandGroup>

                <CommandSeparator />

                {/* Navigation */}
                <CommandGroup heading="Navigate">
                    <CommandItem onSelect={() => handleAction('requests')}>
                        <FileText className="mr-2 h-4 w-4" />
                        <span>All Requests</span>
                    </CommandItem>
                    <CommandItem onSelect={() => handleAction('roadmap')}>
                        <LayoutGrid className="mr-2 h-4 w-4" />
                        <span>Roadmap Board</span>
                    </CommandItem>
                    <CommandItem onSelect={() => handleAction('timeline')}>
                        <Calendar className="mr-2 h-4 w-4" />
                        <span>Timeline View</span>
                    </CommandItem>
                    <CommandItem onSelect={() => handleAction('changelog')}>
                        <FileText className="mr-2 h-4 w-4" />
                        <span>Changelog</span>
                    </CommandItem>
                </CommandGroup>

                {/* Search Results */}
                {requests.length > 0 && (
                    <>
                        <CommandSeparator />
                        <CommandGroup heading="Requests">
                            {requests.map((request) => (
                                <CommandItem
                                    key={request.id}
                                    onSelect={() => handleSelectRequest(request.id)}
                                >
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-sm text-muted-foreground">
                                            {request.vote_count}
                                        </span>
                                        <span className="truncate">{request.title}</span>
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </>
                )}
            </CommandList>
        </CommandDialog>
    )
}

// Hook to use command palette globally
export function useCommandPalette() {
    const [handlers, setHandlers] = useState<CommandPaletteProps>({})

    const register = useCallback((props: CommandPaletteProps) => {
        setHandlers(props)
    }, [])

    return { handlers, register }
}
