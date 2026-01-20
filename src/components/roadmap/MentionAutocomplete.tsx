'use client'

import { useState, useEffect, useRef, useCallback, forwardRef } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

import { searchUsersForMention } from '@/lib/actions/feature-requests'

interface User {
    id: string
    name: string
    avatar_url: string | null
}

interface MentionAutocompleteProps {
    query: string
    position: { top: number; left: number }
    onSelect: (user: User) => void
    onClose: () => void
}

export const MentionAutocomplete = forwardRef<HTMLDivElement, MentionAutocompleteProps>(
    ({ query, position, onSelect, onClose }, ref) => {
        const [users, setUsers] = useState<User[]>([])
        const [isLoading, setIsLoading] = useState(false)
        const [selectedIndex, setSelectedIndex] = useState(0)

        // Fetch users matching the query
        useEffect(() => {
            if (!query || query.length < 2) {
                setUsers([])
                return
            }

            const fetchUsers = async () => {
                setIsLoading(true)
                try {
                    const results = await searchUsersForMention(query)
                    setUsers(results)
                    setSelectedIndex(0)
                } catch (error) {
                    console.error('Error fetching users:', error)
                    setUsers([])
                } finally {
                    setIsLoading(false)
                }
            }

            const debounce = setTimeout(fetchUsers, 200)
            return () => clearTimeout(debounce)
        }, [query])

        // Keyboard navigation
        useEffect(() => {
            const handleKeyDown = (e: KeyboardEvent) => {
                if (users.length === 0) return

                switch (e.key) {
                    case 'ArrowDown':
                        e.preventDefault()
                        setSelectedIndex(prev => (prev + 1) % users.length)
                        break
                    case 'ArrowUp':
                        e.preventDefault()
                        setSelectedIndex(prev => (prev - 1 + users.length) % users.length)
                        break
                    case 'Enter':
                    case 'Tab':
                        e.preventDefault()
                        if (users[selectedIndex]) {
                            onSelect(users[selectedIndex])
                        }
                        break
                    case 'Escape':
                        e.preventDefault()
                        onClose()
                        break
                }
            }

            document.addEventListener('keydown', handleKeyDown)
            return () => document.removeEventListener('keydown', handleKeyDown)
        }, [users, selectedIndex, onSelect, onClose])

        if (!query || query.length < 2 || (users.length === 0 && !isLoading)) {
            return null
        }

        return (
            <div
                ref={ref}
                className="fixed z-50 bg-popover border rounded-md shadow-lg overflow-hidden min-w-[200px] max-h-[200px] overflow-y-auto"
                style={{
                    top: position.top,
                    left: position.left,
                }}
            >
                {isLoading ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                        Searching...
                    </div>
                ) : users.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                        No users found
                    </div>
                ) : (
                    <ul className="py-1">
                        {users.map((user, index) => (
                            <li
                                key={user.id}
                                className={cn(
                                    "px-3 py-2 flex items-center gap-2 cursor-pointer",
                                    index === selectedIndex && "bg-accent"
                                )}
                                onClick={() => onSelect(user)}
                                onMouseEnter={() => setSelectedIndex(index)}
                            >
                                <Avatar className="h-6 w-6">
                                    <AvatarImage src={user.avatar_url || undefined} />
                                    <AvatarFallback className="text-xs">
                                        {user.name
                                            .split(' ')
                                            .map(n => n[0])
                                            .join('')
                                            .toUpperCase()
                                            .slice(0, 2)}
                                    </AvatarFallback>
                                </Avatar>
                                <span className="text-sm">{user.name}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        )
    }
)

MentionAutocomplete.displayName = 'MentionAutocomplete'

// Hook to handle @mention detection in text
export function useMentionDetection(text: string, cursorPosition: number) {
    const [mentionQuery, setMentionQuery] = useState<string | null>(null)
    const [mentionStart, setMentionStart] = useState<number>(-1)

    useEffect(() => {
        if (cursorPosition <= 0) {
            setMentionQuery(null)
            setMentionStart(-1)
            return
        }

        // Look backwards from cursor for @
        const textBeforeCursor = text.slice(0, cursorPosition)
        const lastAtIndex = textBeforeCursor.lastIndexOf('@')

        if (lastAtIndex === -1) {
            setMentionQuery(null)
            setMentionStart(-1)
            return
        }

        // Check if @ is at start or preceded by whitespace
        if (lastAtIndex > 0 && !/\s/.test(text[lastAtIndex - 1])) {
            setMentionQuery(null)
            setMentionStart(-1)
            return
        }

        // Extract query (text between @ and cursor)
        const query = textBeforeCursor.slice(lastAtIndex + 1)

        // Don't trigger if there's a space in the query (mention completed)
        if (query.includes(' ')) {
            setMentionQuery(null)
            setMentionStart(-1)
            return
        }

        setMentionQuery(query)
        setMentionStart(lastAtIndex)
    }, [text, cursorPosition])

    return { mentionQuery, mentionStart }
}
