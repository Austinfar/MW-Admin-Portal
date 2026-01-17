'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { deleteSalesCallLog } from '@/lib/actions/sales'
import { format } from 'date-fns'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, ExternalLink, Calendar, CheckCircle2, User, Loader2, Clock, FileText, AlertCircle, Trash2 } from 'lucide-react'
import { ReportViewer } from '@/components/dashboard/sales/report-viewer'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'


interface SalesCallLog {
    id: string
    created_at: string
    client_name: string
    submitted_by: string
    meeting_url: string
    report_html: string | null
    status: string
}

export default function SalesPage() {
    const supabase = createClient()
    const [logs, setLogs] = useState<SalesCallLog[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [newUrl, setNewUrl] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleAnalyze = async () => {
        if (!newUrl) return

        setIsSubmitting(true)
        try {
            const response = await fetch('/api/sales/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ meeting_url: newUrl }),
            })

            const data = await response.json()

            if (!response.ok) throw new Error(data.error || 'Failed to start analysis')

            toast.success('Analysis started successfully.')

            // Immediate UI update
            const newLog: SalesCallLog = {
                id: data.id,
                created_at: new Date().toISOString(),
                client_name: 'Analysis Pending...',
                submitted_by: 'You', // Or get actual user name if available
                meeting_url: newUrl,
                report_html: null,
                status: 'queued'
            }

            setLogs(prev => [newLog, ...prev])
            setNewUrl('')
            setIsDialogOpen(false)
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to start analysis')
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this sales call log? This action cannot be undone.')) return

        // Optimistic update
        setLogs(logs.filter(log => log.id !== id))
        toast.success('Log deleted')

        try {
            const result = await deleteSalesCallLog(id)

            if (result?.error) {
                throw new Error(result.error)
            }
        } catch (error) {
            console.error('Delete error:', error)
            toast.error(error instanceof Error ? error.message : 'Failed to delete log')
            fetchLogs() // Revert state on error
        }
    }


    useEffect(() => {
        fetchLogs()

        // Subscribe to real-time changes
        const channel = supabase
            .channel('sales_call_logs_changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'sales_call_logs',
                },
                (payload) => {
                    console.log('Real-time update received:', payload)
                    fetchLogs()
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    const fetchLogs = async () => {
        try {
            const { data, error } = await supabase
                .from('sales_call_logs')
                .select('*')
                .order('created_at', { ascending: false })

            if (error) throw error
            setLogs(data || [])
        } catch (error) {
            console.error('Error fetching logs:', error)
            setError(error instanceof Error ? error.message : 'An unknown error occurred')
        } finally {
            setLoading(false)
        }
    }

    const filteredLogs = logs.filter(log =>
        log.client_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.submitted_by?.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-white mb-2">Sales Call Analyzer</h2>
                    <p className="text-muted-foreground">
                        Review AI-analyzed sales calls and generated reports.
                    </p>
                </div>
                <div className="flex items-center space-x-2">
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-rose-600 hover:bg-rose-700 text-white">
                                <Plus className="mr-2 h-4 w-4" /> New Analysis
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-[#1A1A1A] border-gray-800 text-white sm:max-w-[425px]">
                            <DialogHeader>
                                <DialogTitle>Analyze New Call</DialogTitle>
                                <DialogDescription className="text-gray-400">
                                    Paste the Fireflies.ai meeting URL below to start the analysis.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid items-center gap-4">
                                    <Label htmlFor="url" className="text-right sr-only">
                                        URL
                                    </Label>
                                    <Input
                                        id="url"
                                        placeholder="https://app.fireflies.ai/view/..."
                                        className="col-span-3 bg-[#121212] border-gray-700 text-white focus:ring-rose-500"
                                        value={newUrl}
                                        onChange={(e) => setNewUrl(e.target.value)}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button
                                    type="submit"
                                    onClick={handleAnalyze}
                                    disabled={!newUrl || isSubmitting}
                                    className="bg-rose-600 hover:bg-rose-700 text-white"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Starting...
                                        </>
                                    ) : (
                                        'Start Analysis'
                                    )}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <div className="w-full max-w-sm mb-6">
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Search by client or rep..."
                        className="pl-9 bg-[#1A1A1A] border-gray-800 text-white placeholder:text-gray-500 focus:ring-rose-500 focus:border-rose-500"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            <div className="rounded-xl border border-gray-800/60 bg-[#121212]/50 backdrop-blur-sm overflow-hidden">
                <Table>
                    <TableHeader className="bg-gray-900/50">
                        <TableRow className="border-gray-800 hover:bg-transparent">
                            <TableHead className="text-gray-400 font-medium w-[180px]">Date</TableHead>
                            <TableHead className="text-gray-400 font-medium">Client</TableHead>
                            <TableHead className="text-gray-400 font-medium">Submitted By</TableHead>
                            <TableHead className="text-gray-400 font-medium">Status</TableHead>
                            <TableHead className="text-gray-400 font-medium text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">
                                    <div className="flex items-center justify-center text-muted-foreground">
                                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                                        Loading logs...
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : error ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center text-red-500">
                                    Error loading logs: {error}
                                </TableCell>
                            </TableRow>
                        ) : filteredLogs.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                    No call logs found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredLogs.map((log) => (
                                <TableRow key={log.id} className="border-gray-800 hover:bg-[#1A1A1A]/50 transition-colors">
                                    <TableCell className="font-medium text-gray-300">
                                        <div className="flex items-center">
                                            <Calendar className="h-3.5 w-3.5 mr-2 text-rose-500/70" />
                                            {format(new Date(log.created_at), 'MMM d, yyyy h:mm a')}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-white font-semibold">
                                        {log.client_name || 'Unknown'}
                                    </TableCell>
                                    <TableCell className="text-gray-400">
                                        <div className="flex items-center">
                                            <User className="h-3.5 w-3.5 mr-2 text-gray-500" />
                                            {log.submitted_by || '-'}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {(() => {
                                            const s = log.status?.toLowerCase() || 'analyzed'
                                            if (s === 'queued') {
                                                return (
                                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
                                                        <Clock className="h-3 w-3 mr-1" /> Queued
                                                    </span>
                                                )
                                            }
                                            if (s === 'transcribing') {
                                                return (
                                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-500 border border-blue-500/20">
                                                        <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Transcribing
                                                    </span>
                                                )
                                            }
                                            if (s === 'analyzing') {
                                                return (
                                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-500/10 text-purple-500 border border-purple-500/20">
                                                        <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Analyzing
                                                    </span>
                                                )
                                            }
                                            if (s === 'failed') {
                                                return (
                                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-500 border border-red-500/20">
                                                        <AlertCircle className="h-3 w-3 mr-1" /> Failed
                                                    </span>
                                                )
                                            }
                                            // Default / Completed
                                            return (
                                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                                    Completed
                                                </span>
                                            )
                                        })()}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {log.meeting_url && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    asChild
                                                    className="h-8 w-8 text-gray-400 hover:text-white hover:bg-gray-800"
                                                >
                                                    <a href={log.meeting_url} target="_blank" rel="noopener noreferrer">
                                                        <ExternalLink className="h-4 w-4" />
                                                    </a>
                                                </Button>
                                            )}
                                            {log.report_html ? (
                                                <ReportViewer
                                                    reportHtml={log.report_html}
                                                    clientName={log.client_name || 'Prospect'}
                                                    date={format(new Date(log.created_at), 'MMM d, yyyy')}
                                                />
                                            ) : (
                                                <Button variant="ghost" size="icon" disabled className="h-8 w-8 text-gray-600 cursor-not-allowed">
                                                    <FileText className="h-4 w-4" />
                                                </Button>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleDelete(log.id)}
                                                className="h-8 w-8 text-gray-500 hover:text-red-500 hover:bg-red-500/10"
                                                title="Delete Log"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
