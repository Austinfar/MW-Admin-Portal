'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { Mail, Phone, ArrowRight, Trash2, MessageSquare, Activity, ExternalLink, UserPlus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { convertLeadToClient, deleteLead, updateLeadAppointmentSetter, getLeadActivity } from '@/lib/actions/lead-actions'
import { LeadMetadataCard } from '@/components/leads/LeadMetadataCard'
import { LeadJourneyStepper } from '@/components/leads/LeadJourneyStepper'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface Lead {
    id: string
    first_name: string
    last_name: string | null
    email: string | null
    phone: string | null
    status: string
    source: string | null
    description: string | null
    ghl_contact_id: string | null
    created_at: string
    updated_at: string
    booked_by_user_id: string | null
    metadata?: Record<string, any>
}

interface ActivityLog {
    id: string
    type: string
    description: string | null
    created_at: string
    metadata?: Record<string, any>
}

interface SimpleUser {
    id: string
    name: string | null
}

interface LeadDetailClientProps {
    lead: Lead
    ghlLocationId?: string
    resolvedCoachName?: string | null
}

export function LeadDetailClient({ lead, ghlLocationId, resolvedCoachName }: LeadDetailClientProps) {
    const router = useRouter()
    const [users, setUsers] = useState<SimpleUser[]>([])
    const [loadingUsers, setLoadingUsers] = useState(true)
    const [selectedSetter, setSelectedSetter] = useState<string>(lead.booked_by_user_id || '')
    const [updatingSetter, setUpdatingSetter] = useState(false)
    const [isAdmin, setIsAdmin] = useState(false)
    const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([])
    const [loadingActivity, setLoadingActivity] = useState(true)

    useEffect(() => {
        async function fetchActivity() {
            try {
                const logs = await getLeadActivity(lead.id)
                setActivityLogs(logs || [])
            } catch (e) {
                console.error('Failed to fetch activity', e)
            } finally {
                setLoadingActivity(false)
            }
        }
        fetchActivity()
    }, [lead.id])

    // Fetch users for appointment setter dropdown and check if current user is admin
    useEffect(() => {
        async function init() {
            try {
                const { getAllUsers, getCurrentUserProfile } = await import('@/lib/actions/profile')
                const profile = await getCurrentUserProfile()
                if (profile?.role === 'super_admin' || profile?.role === 'admin') {
                    setIsAdmin(true)
                    const { users: allUsers } = await getAllUsers()
                    if (allUsers) {
                        // Filter to setters/appointment setters or just show all for flexibility
                        setUsers(allUsers.map(u => ({ id: u.id, name: u.name })))
                    }
                }
            } catch (e) {
                console.error('Failed to fetch users', e)
            } finally {
                setLoadingUsers(false)
            }
        }
        init()
    }, [])

    const handleSetterChange = async (newSetterId: string) => {
        setSelectedSetter(newSetterId)
        setUpdatingSetter(true)
        try {
            const result = await updateLeadAppointmentSetter(lead.id, newSetterId || null)
            if (result.error) {
                toast.error(result.error)
                setSelectedSetter(lead.booked_by_user_id || '')
            } else {
                toast.success('Appointment setter updated')
            }
        } catch (e) {
            toast.error('Failed to update appointment setter')
            setSelectedSetter(lead.booked_by_user_id || '')
        } finally {
            setUpdatingSetter(false)
        }
    }

    const getStatusColor = (status: string) => {
        const styles: Record<string, string> = {
            'New': 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
            'Contacted': 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400',
            'Qualified': 'bg-purple-500/15 text-purple-700 dark:text-purple-400',
            'Won': 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
            'Lost': 'bg-red-500/15 text-red-700 dark:text-red-400',
        }
        return styles[status] || 'bg-gray-500/15 text-gray-700'
    }

    const handleConvert = async () => {
        toast.promise(async () => {
            const result = await convertLeadToClient(lead.id)
            if (result?.error) throw new Error(result.error)
            router.push('/clients')
        }, {
            loading: 'Converting to client...',
            success: 'Lead converted successfully!',
            error: (err) => `Failed to convert: ${err}`
        })
    }

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this lead? This cannot be undone.')) return

        toast.promise(async () => {
            await deleteLead(lead.id)
            router.push('/leads')
        }, {
            loading: 'Deleting...',
            success: 'Lead deleted',
            error: 'Failed to delete'
        })
    }

    const ghlContactUrl = lead.ghl_contact_id && ghlLocationId
        ? `https://app.gohighlevel.com/v2/location/${ghlLocationId}/contacts/detail/${lead.ghl_contact_id}`
        : null

    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            {/* Header Area */}
            <div className="flex items-start justify-between">
                <div className="flex items-center space-x-4">
                    <Avatar className="h-20 w-20 border-2 border-primary/20">
                        <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${lead.first_name}`} />
                        <AvatarFallback>{lead.first_name.substring(0, 1).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <h2 className="text-3xl font-bold tracking-tight text-foreground">
                                {lead.first_name} {lead.last_name}
                            </h2>
                            <Badge variant="secondary" className={getStatusColor(lead.status)}>
                                {lead.status}
                            </Badge>
                        </div>
                        <div className="text-muted-foreground flex items-center gap-4">
                            <a href={`mailto:${lead.email}`} className="flex items-center gap-1 hover:text-neon-green transition-colors">
                                <Mail className="h-4 w-4" /> {lead.email || 'No email'}
                            </a>
                            <span className="text-gray-600">|</span>
                            <a href={`tel:${lead.phone}`} className="flex items-center gap-1 hover:text-neon-green transition-colors">
                                <Phone className="h-4 w-4" /> {lead.phone || 'No phone'}
                            </a>
                        </div>
                    </div>
                </div>
                <div className="flex space-x-2">
                    {ghlContactUrl && (
                        <Button variant="outline" className="bg-card/40 border-primary/10 hover:border-primary/30" asChild>
                            <a href={ghlContactUrl} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="mr-2 h-4 w-4" />
                                View in GHL
                            </a>
                        </Button>
                    )}
                    <Button variant="destructive" onClick={handleDelete}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                    </Button>
                    <Button onClick={handleConvert} className="bg-neon-green text-black hover:bg-neon-green/90">
                        <ArrowRight className="mr-2 h-4 w-4" />
                        Convert to Client
                    </Button>
                </div>
            </div>

            <div className="mb-6">
                <LeadJourneyStepper
                    metadata={lead.metadata || null}
                    status={lead.status}
                    coachName={resolvedCoachName}
                />
            </div>

            <Separator className="bg-primary/10 mb-6" />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-250px)]">
                {/* Left Column: Identity & Contact (3 cols) */}
                <div className="lg:col-span-3 space-y-6">
                    {/* Lead Details Card */}
                    <Card className="bg-card/40 border-primary/5 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle className="text-lg">Lead Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex justify-between items-center border-b border-primary/5 pb-2">
                                <span className="text-sm text-muted-foreground">Source</span>
                                <Badge variant="outline">{lead.source || 'Manual'}</Badge>
                            </div>
                            <div className="flex justify-between items-center border-b border-primary/5 pb-2">
                                <span className="text-sm text-muted-foreground">Created</span>
                                <span className="text-sm font-medium">{format(new Date(lead.created_at), 'MMM d, yyyy')}</span>
                            </div>
                            <div className="flex justify-between items-center border-b border-primary/5 pb-2">
                                <span className="text-sm text-muted-foreground">Last Updated</span>
                                <span className="text-sm font-medium">{format(new Date(lead.updated_at), 'MMM d, yyyy')}</span>
                            </div>
                            {isAdmin && (
                                <div className="flex justify-between items-center pb-2">
                                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                                        <UserPlus className="h-3 w-3" />
                                        Appt. Setter
                                    </span>
                                    {loadingUsers ? (
                                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                    ) : (
                                        <div className="relative">
                                            <select
                                                className="h-8 px-2 py-1 bg-[#1a1a1a] border border-white/10 rounded-md text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50"
                                                value={selectedSetter}
                                                onChange={(e) => handleSetterChange(e.target.value)}
                                                disabled={updatingSetter}
                                            >
                                                <option value="">None</option>
                                                {users.map(u => (
                                                    <option key={u.id} value={u.id}>{u.name || 'Unknown'}</option>
                                                ))}
                                            </select>
                                            {updatingSetter && (
                                                <Loader2 className="absolute right-6 top-2 h-3 w-3 animate-spin text-emerald-500" />
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Quick Actions */}
                    <Card className="bg-card/40 border-primary/5 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle className="text-lg">Quick Actions</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <Button variant="outline" className="w-full justify-start" asChild>
                                <a href={`mailto:${lead.email}`}>
                                    <Mail className="mr-2 h-4 w-4" />
                                    Send Email
                                </a>
                            </Button>
                            <Button variant="outline" className="w-full justify-start" asChild>
                                <a href={`tel:${lead.phone}`}>
                                    <Phone className="mr-2 h-4 w-4" />
                                    Call Lead
                                </a>
                            </Button>
                            <Button variant="outline" className="w-full justify-start" asChild>
                                <a href={`sms:${lead.phone}`}>
                                    <MessageSquare className="mr-2 h-4 w-4" />
                                    Send SMS
                                </a>
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                {/* Main Column: Notes & Activity (6 cols) */}
                <div className="lg:col-span-6 space-y-6 h-full flex flex-col">
                    {/* Metadata Card */}
                    <LeadMetadataCard
                        metadata={lead.metadata || null}
                        resolvedCoachName={resolvedCoachName}
                    />

                    <Tabs defaultValue="activity" className="w-full flex-1 flex flex-col">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="activity">Activity</TabsTrigger>
                            <TabsTrigger value="notes">Notes</TabsTrigger>
                        </TabsList>
                        <TabsContent value="notes" className="mt-4 flex-1">
                            <Card className="bg-card/40 border-primary/5 backdrop-blur-sm h-full">
                                <CardHeader>
                                    <CardTitle>Notes</CardTitle>
                                    <CardDescription>Add notes about this lead</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {lead.description ? (
                                        <div className="bg-zinc-900/50 rounded-lg p-4 text-sm">
                                            {lead.description}
                                        </div>
                                    ) : (
                                        <div className="text-center text-muted-foreground py-8">
                                            No notes yet. Use the description field to add notes.
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>
                        <TabsContent value="activity" className="mt-4 flex-1">
                            <Card className="bg-card/40 border-primary/5 backdrop-blur-sm h-full max-h-[600px] overflow-y-auto">
                                <CardHeader>
                                    <CardTitle>Activity Timeline</CardTitle>
                                    <CardDescription>Recent activity for this lead</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {loadingActivity ? (
                                        <div className="flex justify-center p-8">
                                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                        </div>
                                    ) : activityLogs.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                                            <Activity className="h-8 w-8 mb-2 opacity-50" />
                                            <p>No activity recorded yet.</p>
                                        </div>
                                    ) : (
                                        <div className="relative space-y-6 pl-4 border-l border-primary/10 ml-2">
                                            {activityLogs.map((log) => (
                                                <div key={log.id} className="relative">
                                                    <div className="absolute -left-[21px] mt-1.5 h-3 w-3 rounded-full border border-primary/30 bg-background" />
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm font-medium text-foreground">{log.type}</span>
                                                            <span className="text-xs text-muted-foreground">
                                                                {format(new Date(log.created_at), 'MMM d, h:mm a')}
                                                            </span>
                                                        </div>
                                                        {log.description && (
                                                            <p className="text-sm text-muted-foreground">{log.description}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>

                {/* Right Column: Status & Conversion (3 cols) */}
                <div className="lg:col-span-3 space-y-6">
                    <Card className="bg-card/40 border-primary/5 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle className="text-lg">Lead Status</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex flex-col gap-2">
                                {['New', 'Contacted', 'Qualified', 'Won', 'Lost'].map((status) => (
                                    <div
                                        key={status}
                                        className={`px-3 py-2 rounded-lg border transition-colors ${lead.status === status
                                            ? 'border-neon-green bg-neon-green/10 text-neon-green'
                                            : 'border-zinc-800 text-zinc-500'
                                            }`}
                                    >
                                        {status}
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-card/40 border-primary/5 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle className="text-lg">Conversion</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground mb-4">
                                Ready to onboard this lead? Convert them to a client to start their journey.
                            </p>
                            <Button onClick={handleConvert} className="w-full bg-neon-green text-black hover:bg-neon-green/90">
                                <ArrowRight className="mr-2 h-4 w-4" />
                                Convert to Client
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
