'use client'

import { useState, useEffect, useCallback } from 'react'
import { Bell, Check, CheckCheck, X, MessageCircle, ArrowUpCircle, AlertCircle, Star } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'

import {
    getNotifications,
    getUnreadNotificationCount,
    markNotificationRead,
    markAllNotificationsRead,
} from '@/lib/actions/feature-requests'
import type { FeatureNotification, NotificationType } from '@/types/roadmap'
import { cn } from '@/lib/utils'

const NOTIFICATION_ICONS: Record<NotificationType, React.ReactNode> = {
    status_change: <ArrowUpCircle className="h-4 w-4 text-blue-400" />,
    new_comment: <MessageCircle className="h-4 w-4 text-cyan-400" />,
    mention: <AlertCircle className="h-4 w-4 text-amber-400" />,
    completed: <Star className="h-4 w-4 text-neon-green" />,
}

interface NotificationBellProps {
    className?: string
}

export function NotificationBell({ className }: NotificationBellProps) {
    const [notifications, setNotifications] = useState<FeatureNotification[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [isOpen, setIsOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)

    const fetchNotifications = useCallback(async () => {
        setIsLoading(true)
        try {
            const [notifs, count] = await Promise.all([
                getNotifications(20),
                getUnreadNotificationCount(),
            ])
            setNotifications(notifs)
            setUnreadCount(count)
        } catch (error) {
            console.error('Error fetching notifications:', error)
        } finally {
            setIsLoading(false)
        }
    }, [])

    // Fetch on mount and when popover opens
    useEffect(() => {
        fetchNotifications()
    }, [])

    useEffect(() => {
        if (isOpen) {
            fetchNotifications()
        }
    }, [isOpen, fetchNotifications])

    // Poll for new notifications every 30 seconds
    useEffect(() => {
        const interval = setInterval(async () => {
            const count = await getUnreadNotificationCount()
            setUnreadCount(count)
        }, 30000)

        return () => clearInterval(interval)
    }, [])

    const handleMarkRead = async (id: string) => {
        await markNotificationRead(id)
        setNotifications(prev =>
            prev.map(n => n.id === id ? { ...n, is_read: true } : n)
        )
        setUnreadCount(prev => Math.max(0, prev - 1))
    }

    const handleMarkAllRead = async () => {
        await markAllNotificationsRead()
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
        setUnreadCount(0)
    }

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className={cn("relative", className)}
                >
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-neon-green text-[10px] font-bold text-black">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
                <div className="flex items-center justify-between px-4 py-3 border-b">
                    <h4 className="font-semibold">Notifications</h4>
                    {unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-7"
                            onClick={handleMarkAllRead}
                        >
                            <CheckCheck className="h-3.5 w-3.5 mr-1" />
                            Mark all read
                        </Button>
                    )}
                </div>

                <ScrollArea className="h-[320px]">
                    {notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                            <Bell className="h-8 w-8 mb-2 opacity-20" />
                            <p className="text-sm">No notifications yet</p>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {notifications.map((notification) => (
                                <NotificationItem
                                    key={notification.id}
                                    notification={notification}
                                    onMarkRead={handleMarkRead}
                                    onClose={() => setIsOpen(false)}
                                />
                            ))}
                        </div>
                    )}
                </ScrollArea>

                {notifications.length > 0 && (
                    <>
                        <Separator />
                        <div className="p-2&quot;">
                            <Link href="/roadmap">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-full text-xs"
                                    onClick={() => setIsOpen(false)}
                                >
                                    View all in Roadmap
                                </Button>
                            </Link>
                        </div>
                    </>
                )}
            </PopoverContent>
        </Popover>
    )
}

function NotificationItem({
    notification,
    onMarkRead,
    onClose,
}: {
    notification: FeatureNotification
    onMarkRead: (id: string) => void
    onClose: () => void
}) {
    const icon = NOTIFICATION_ICONS[notification.type] || <Bell className="h-4 w-4" />

    const handleClick = () => {
        if (!notification.is_read) {
            onMarkRead(notification.id)
        }
        onClose()
    }

    return (
        <Link
            href={notification.request_id ? `/roadmap?request=${notification.request_id}` : '/roadmap'}
            onClick={handleClick}
        >
            <div
                className={cn(
                    "flex items-start gap-3 px-4 py-3 hover:bg-accent/50 transition-colors cursor-pointer",
                    !notification.is_read && "bg-neon-green/5"
                )}
            >
                <div className="flex-shrink-0 mt-0.5">
                    {icon}
                </div>
                <div className="flex-1 min-w-0">
                    <p className={cn(
                        "text-sm line-clamp-2",
                        !notification.is_read && "font-medium"
                    )}>
                        {notification.message}
                    </p>
                    {notification.request && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {notification.request.title}
                        </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                    </p>
                </div>
                {!notification.is_read && (
                    <div className="flex-shrink-0">
                        <div className="h-2 w-2 rounded-full bg-neon-green" />
                    </div>
                )}
            </div>
        </Link>
    )
}
