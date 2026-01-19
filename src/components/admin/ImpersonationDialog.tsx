'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Loader2 } from 'lucide-react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { startImpersonation, searchUsers } from '@/lib/actions/impersonation'
import { toast } from 'sonner'

interface User {
    id: string
    email: string
    first_name: string | null
    last_name: string | null
    role: string
    avatar_url: string | null
}

interface ImpersonationDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function ImpersonationDialog({ open, onOpenChange }: ImpersonationDialogProps) {
    const [query, setQuery] = useState('')
    const [users, setUsers] = useState<User[]>([])
    const [loading, setLoading] = useState(false)
    const [impersonating, setImpersonating] = useState<string | null>(null)
    const router = useRouter()

    useEffect(() => {
        // Load initial users
        handleSearch('')
    }, [])

    const handleSearch = async (val: string) => {
        setQuery(val)
        setLoading(true)
        const result = await searchUsers(val)
        if (result.error) {
            console.error('[ImpersonationDialog] Search error:', result.error)
            // toast.error(result.error) // Optional: don't spam toasts on typing
        }
        if (result.users) {
            setUsers(result.users)
        } else {
            setUsers([])
        }
        setLoading(false)
    }

    const handleImpersonate = async (userId: string) => {
        setImpersonating(userId)
        try {
            const result = await startImpersonation(userId)
            if (result.error) {
                toast.error(result.error)
            } else if (result.redirectUrl) {
                toast.success('Starting impersonation...')
                // Force a full page reload/navigation to ensure sessions are reset
                window.location.href = result.redirectUrl
            }
        } catch (error) {
            toast.error('Failed to start impersonation')
        } finally {
            setImpersonating(null)
        }
    }

    const getInitials = (user: User) => {
        const first = user.first_name?.[0] || ''
        const last = user.last_name?.[0] || ''
        return (first + last).toUpperCase() || user.email[0].toUpperCase()
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Log in as...</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by name or email..."
                            value={query}
                            onChange={(e) => handleSearch(e.target.value)}
                            className="pl-8"
                            autoFocus
                        />
                    </div>
                    <div className="max-h-[300px] overflow-y-auto space-y-2">
                        {loading ? (
                            <div className="flex justify-center py-4">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : users.length > 0 ? (
                            users.map((user) => (
                                <div
                                    key={user.id}
                                    className="flex items-center justify-between p-2 hover:bg-muted/50 rounded-lg transition-colors border border-transparent hover:border-border"
                                >
                                    <div className="flex items-center space-x-3 overflow-hidden">
                                        <Avatar className="h-8 w-8">
                                            <AvatarImage src={user.avatar_url || ''} />
                                            <AvatarFallback>{getInitials(user)}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex flex-col truncate">
                                            <span className="font-medium text-sm truncate">
                                                {user.first_name} {user.last_name}
                                            </span>
                                            <span className="text-xs text-muted-foreground truncate">
                                                {user.email} • {user.role}
                                            </span>
                                        </div>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        disabled={impersonating === user.id}
                                        onClick={() => handleImpersonate(user.id)}
                                    >
                                        {impersonating === user.id ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            'Log in as'
                                        )}
                                    </Button>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-4 text-sm text-muted-foreground">
                                No users found
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
