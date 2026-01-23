'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { ExternalLink, Calendar, User, Phone, MoreHorizontal, Link as LinkIcon, Trash2, FileText, Loader2 } from 'lucide-react'
import { ReportViewer } from '@/components/dashboard/sales/report-viewer'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LinkClientDialog } from '@/components/dashboard/sales/link-client-dialog'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { deleteSalesCallLog } from '@/lib/actions/sales'

interface SalesCallLog {
    id: string
    created_at: string
    client_name: string
    submitted_by: string
    meeting_url: string
    report_url?: string | null
    report_html: string | null
    pdf_download_url?: string | null
    status: string
    client_id?: string | null
    clients?: {
        name: string
    } | null
}

export function ClientSalesCalls({ clientId }: { clientId: string }) {
    const supabase = createClient()
    const [logs, setLogs] = useState<SalesCallLog[]>([])
    const [loading, setLoading] = useState(true)
    const [linkClientDialogOpen, setLinkClientDialogOpen] = useState(false)
    const [selectedLog, setSelectedLog] = useState<SalesCallLog | null>(null)

    const fetchLogs = async () => {
        const { data, error } = await supabase
            .from('sales_call_logs')
            .select(`
                *,
                clients (
                    id,
                    name
                )
            `)
            .eq('client_id', clientId)
            .order('created_at', { ascending: false })

        if (error) {
            console.error('Error fetching sales logs:', error)
            toast.error('Failed to load sales calls')
        } else {
            // Transform data to match interface
            const formattedData = data?.map(log => ({
                ...log,
                clients: Array.isArray(log.clients) ? log.clients[0] : log.clients
            })) as unknown as SalesCallLog[]

            setLogs(formattedData || [])
        }
        setLoading(false)
    }

    useEffect(() => {
        fetchLogs()
    }, [clientId])

    const handleDelete = async (id: string) => {
        toast.promise(deleteSalesCallLog(id), {
            loading: 'Deleting log...',
            success: () => {
                setLogs(prev => prev.filter(log => log.id !== id))
                return 'Log deleted'
            },
            error: 'Failed to delete log'
        })
    }

    if (loading) return <div className="p-4 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />Loading sales calls...</div>

    if (logs.length === 0) {
        return (
            <Card className="bg-card/50 backdrop-blur-xl border-white/5 hover:border-primary/20 transition-all duration-300 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)] h-full">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <div className="p-2 rounded-full bg-blue-500/10">
                            <Phone className="h-4 w-4 text-blue-500" />
                        </div>
                        Sales Calls
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-8 text-muted-foreground border border-dashed border-white/10 rounded-xl bg-white/5">
                        No calls analyzed for this client yet.
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="bg-card/50 backdrop-blur-xl border-white/5 hover:border-primary/20 transition-all duration-300 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)] h-full flex flex-col">
            <CardHeader className="shrink-0">
                <CardTitle className="flex items-center gap-2">
                    <div className="p-2 rounded-full bg-blue-500/10">
                        <Phone className="h-4 w-4 text-blue-500" />
                    </div>
                    Sales Calls
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto scrollbar-thin">
                <div className="space-y-4">
                    {logs.map((log) => (
                        <div key={log.id} className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3 hover:border-white/20 transition-all duration-200">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h3 className="text-white font-semibold text-lg">{log.client_name || 'Unknown'}</h3>
                                    <div className="flex items-center text-xs text-gray-500 mt-1">
                                        <Calendar className="h-3 w-3 mr-1" />
                                        {format(new Date(log.created_at), 'MMM d, h:mm a')}
                                    </div>
                                </div>
                                {(() => {
                                    const s = log.status?.toLowerCase() || 'analyzed'
                                    if (s === 'queued') return <span className="text-xs font-medium text-yellow-500 bg-yellow-500/10 px-2 py-1 rounded border border-yellow-500/20">Queued</span>
                                    if (s === 'transcribing') return <span className="text-xs font-medium text-blue-500 bg-blue-500/10 px-2 py-1 rounded border border-blue-500/20">Transcribing</span>
                                    if (s === 'analyzing') return <span className="text-xs font-medium text-purple-500 bg-purple-500/10 px-2 py-1 rounded border border-purple-500/20">Analyzing</span>
                                    if (s === 'failed') return <span className="text-xs font-medium text-red-500 bg-red-500/10 px-2 py-1 rounded border border-red-500/20">Failed</span>
                                    return <span className="text-xs font-medium text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">Completed</span>
                                })()}
                            </div>

                            <div className="flex items-center text-sm text-muted-foreground bg-white/5 p-2 rounded-lg">
                                <User className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                                <span className="text-xs uppercase tracking-wide text-muted-foreground/60 mr-2">Submitted By:</span>
                                {log.submitted_by || '-'}
                            </div>

                            <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-white/5">
                                <div className="flex-1">
                                    {(log.status === 'completed' && (log.report_html || log.report_url)) && (
                                        <div onClick={(e) => e.stopPropagation()}>
                                            <ReportViewer
                                                reportHtml={log.report_html}
                                                reportUrl={log.report_url}
                                                pdfDownloadUrl={log.pdf_download_url}
                                                clientName={log.client_name || 'Unknown'}
                                                date={format(new Date(log.created_at), 'MMM d, yyyy')}
                                                trigger={
                                                    <Button variant="ghost" size="sm" className="h-8 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 px-2 -ml-2">
                                                        <FileText className="h-3.5 w-3.5 mr-1.5" />
                                                        View Report
                                                    </Button>
                                                }
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center gap-1">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            setSelectedLog(log)
                                            setLinkClientDialogOpen(true)
                                        }}
                                        className={cn(
                                            "h-8 w-8 shrink-0 transition-colors",
                                            log.client_id
                                                ? 'text-emerald-500 hover:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20'
                                                : 'text-gray-500 hover:text-gray-400 hover:bg-white/5'
                                        )}
                                        title={log.client_id ? "Linked to Client" : "Link Client"}
                                    >
                                        <LinkIcon className="h-4 w-4" />
                                    </Button>

                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-white shrink-0 hover:bg-white/5" onClick={(e) => e.stopPropagation()}>
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-[180px] bg-[var(--glass-bg)] backdrop-blur-xl border-white/10 text-foreground">
                                            {log.meeting_url && (
                                                <>
                                                    <DropdownMenuItem asChild>
                                                        <a
                                                            href={log.meeting_url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="cursor-pointer hover:bg-white/5 focus:bg-white/5 w-full flex items-center"
                                                        >
                                                            <ExternalLink className="h-4 w-4 mr-2 text-blue-400" />
                                                            Fireflies.ai
                                                        </a>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator className="bg-white/10" />
                                                </>
                                            )}

                                            <DropdownMenuItem
                                                onClick={() => {
                                                    setSelectedLog(log)
                                                    setLinkClientDialogOpen(true)
                                                }}
                                                className="cursor-pointer hover:bg-white/5 focus:bg-white/5 flex flex-col items-start gap-1"
                                            >
                                                <div className="flex items-center w-full">
                                                    <LinkIcon className={cn("h-4 w-4 mr-2", log.client_id ? "text-emerald-500" : "text-gray-400")} />
                                                    {log.client_id ? 'Update Link' : 'Link Client'}
                                                </div>
                                            </DropdownMenuItem>

                                            <DropdownMenuSeparator className="bg-gray-800" />

                                            <DropdownMenuItem
                                                onClick={() => handleDelete(log.id)}
                                                className="text-red-500 cursor-pointer hover:bg-red-500/10 focus:bg-red-500/10 focus:text-red-500"
                                            >
                                                <Trash2 className="h-4 w-4 mr-2" />
                                                Delete Log
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>

            <LinkClientDialog
                open={linkClientDialogOpen}
                onOpenChange={setLinkClientDialogOpen}
                logId={selectedLog?.id || ''}
                currentClientId={selectedLog?.client_id}
                currentClientName={selectedLog?.clients?.name}
                onSuccess={() => {
                    fetchLogs()
                    setLinkClientDialogOpen(false)
                }}
            />
        </Card>
    )
}
