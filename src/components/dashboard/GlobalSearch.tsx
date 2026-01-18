'use client'

import * as React from 'react'
import { CheckCircle, RotateCcw, CreditCard, User, Calendar, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from '@/components/ui/command'
import { searchGlobal, type GlobalSearchResults, type SearchResult } from '@/lib/actions/search-actions'
import { formatCurrency, cn } from '@/lib/utils'
import { useEasterEgg } from './EasterEggProvider'

interface GlobalSearchProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
    const router = useRouter()
    const [query, setQuery] = React.useState('')
    const [results, setResults] = React.useState<GlobalSearchResults>({ clients: [], payments: [], coaches: [] })
    const [loading, setLoading] = React.useState(false)
    const { triggerEasterEgg } = useEasterEgg()

    React.useEffect(() => {
        if (query.toLowerCase() === '100k month') {
            triggerEasterEgg()
            setQuery('')
            return
        }

        if (!query || query.length < 2) {
            setResults({ clients: [], payments: [], coaches: [] })
            return
        }

        const timer = setTimeout(async () => {
            setLoading(true)
            try {
                console.log('[GlobalSearch] Searching for:', query)
                const data = await searchGlobal(query)
                console.log('[GlobalSearch] Received:', data)
                setResults(data)
            } catch (error) {
                console.error('Search failed', error)
            } finally {
                setLoading(false)
            }
        }, 300)

        return () => clearTimeout(timer)
    }, [query])

    const handleSelect = (result: SearchResult) => {
        onOpenChange(false)
        if (result.type === 'client') {
            router.push(`/clients/${result.id}`)
        } else if (result.type === 'payment') {
            // Link to the client page, highlighting the payment if possible or just the client
            router.push(`/clients/${result.metadata?.clientId || ''}`)
        } else if (result.type === 'coach') {
            // Redirect to the Team settings page
            router.push(`/settings/team`)
        }
    }

    return (
        <CommandDialog open={open} onOpenChange={onOpenChange} shouldFilter={false}>
            <CommandInput
                placeholder="Type a command or search..."
                value={query}
                onValueChange={setQuery}
            />
            <CommandList>
                <CommandEmpty>No results found.</CommandEmpty>
                {loading && (
                    <div className="py-6 text-center text-sm text-muted-foreground flex justify-center">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Searching...
                    </div>
                )}
                {!loading && (
                    <>
                        {results.clients.length > 0 && (
                            <CommandGroup heading="Customers">
                                {results.clients.map((client) => (
                                    <CommandItem
                                        key={client.id}
                                        onSelect={() => handleSelect(client)}
                                        className="flex justify-between items-center"
                                    >
                                        <div className="flex items-center gap-2">
                                            <User className="h-4 w-4 text-muted-foreground" />
                                            <div className="flex flex-col">
                                                <span className="font-medium flex items-center gap-2">
                                                    {client.title}
                                                    {/* Simulate 'Guest' badge if needed */}
                                                    {client.status === 'guest' && (
                                                        <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground uppercase tracking-wider">
                                                            Guest
                                                        </span>
                                                    )}
                                                </span>
                                                <span className="text-xs text-muted-foreground">{client.subtitle}</span>
                                            </div>
                                        </div>
                                        {client.date && (
                                            <span className="text-xs text-muted-foreground">
                                                {new Date(client.date).toLocaleDateString()}
                                            </span>
                                        )}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        )}

                        <CommandSeparator />

                        {results.payments.length > 0 && (
                            <CommandGroup heading="Payments">
                                {results.payments.map((payment) => (
                                    <CommandItem
                                        key={payment.id}
                                        onSelect={() => handleSelect(payment)}
                                        className="flex justify-between items-center"
                                    >
                                        <div className="flex items-center gap-2">
                                            {payment.status === 'succeeded' || payment.status === 'paid' ? (
                                                <CheckCircle className="h-4 w-4 text-green-500" />
                                            ) : payment.status === 'refunded' ? (
                                                <RotateCcw className="h-4 w-4 text-muted-foreground" />
                                            ) : (
                                                <CreditCard className="h-4 w-4 text-muted-foreground" />
                                            )}
                                            <div className="flex flex-col">
                                                <span className="font-medium">
                                                    {payment.amount ? formatCurrency(payment.amount) : '$0.00'}
                                                </span>
                                                <span className="text-xs text-muted-foreground font-mono">
                                                    {payment.subtitle}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <span className="text-sm">{payment.status}</span>
                                            {payment.date && (
                                                <span className="text-xs text-muted-foreground">
                                                    {new Date(payment.date).toLocaleDateString()}
                                                </span>
                                            )}
                                        </div>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        )}

                        <CommandSeparator />

                        {results.coaches.length > 0 && (
                            <CommandGroup heading="Users">
                                {results.coaches.map((coach) => (
                                    <CommandItem
                                        key={coach.id}
                                        onSelect={() => handleSelect(coach)}
                                        className="flex justify-between items-center"
                                    >
                                        <div className="flex items-center gap-2">
                                            <User className="h-4 w-4 text-indigo-500" />
                                            <div className="flex flex-col">
                                                <span className="font-medium">{coach.title}</span>
                                                <span className="text-xs text-muted-foreground">{coach.subtitle}</span>
                                            </div>
                                        </div>
                                        {coach.status && (
                                            <span className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground uppercase tracking-wider">
                                                {coach.status}
                                            </span>
                                        )}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        )}
                    </>
                )}
            </CommandList>
        </CommandDialog>
    )
}
