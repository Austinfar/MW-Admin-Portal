'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, ArrowRight, Video, FileText, Loader2, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import Link from 'next/link'
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
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface AnalyzedCall {
    id: string
    client_name: string
    created_at: string
    status: string
    score?: number
}

interface SalesCallAnalyzerWidgetProps {
    recentCalls: AnalyzedCall[]
}

export function SalesCallAnalyzerWidget({ recentCalls }: SalesCallAnalyzerWidgetProps) {
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [newUrl, setNewUrl] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleAnalyze = async () => {
        if (!newUrl) return

        if (!newUrl.startsWith('https://app.fireflies.ai/')) {
            toast.error('Invalid URL. Please use a valid Fireflies.ai meeting URL.')
            return
        }

        setIsSubmitting(true)
        try {
            const response = await fetch('/api/sales/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ meeting_url: newUrl }),
            })

            const data = await response.json()

            if (!response.ok) throw new Error(data.error || 'Failed to start analysis')

            toast.success('Analysis started! Check the main Sales tab for progress.')
            setNewUrl('')
            setIsDialogOpen(false)
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to start analysis')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Card className="bg-zinc-900/40 backdrop-blur-xl border-white/5 h-full flex flex-col shadow-2xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <div className="space-y-1">
                    <CardTitle className="text-lg font-medium text-white flex items-center gap-2">
                        <Video className="h-5 w-5 text-rose-500" />
                        Call Analyzer
                    </CardTitle>
                    <CardDescription className="text-xs text-gray-500">
                        Recent AI Analyses
                    </CardDescription>
                </div>
                <Link href="/sales">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-white">
                        <ArrowRight className="h-4 w-4" />
                    </Button>
                </Link>
            </CardHeader>
            <CardContent className="flex-1 space-y-4">
                {/* Analyze New Button */}
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="w-full bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-900/20 transition-all active:scale-[0.98]">
                            <Plus className="mr-2 h-4 w-4" /> Analyze New Call
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-zinc-950/90 backdrop-blur-xl border-white/10 text-white sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>Analyze New Sales Call</DialogTitle>
                            <DialogDescription className="text-gray-400">
                                Paste the Fireflies.ai meeting URL below.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid items-center gap-4">
                                <Label htmlFor="url" className="sr-only">URL</Label>
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
                                onClick={handleAnalyze}
                                disabled={!newUrl || isSubmitting}
                                className="bg-rose-600 hover:bg-rose-700 text-white w-full"
                            >
                                {isSubmitting ? (
                                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Starting...</>
                                ) : (
                                    'Start Analysis'
                                )}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Recent List */}
                <div className="space-y-3">
                    {recentCalls.length === 0 ? (
                        <div className="text-center py-6 text-gray-500 text-sm border border-dashed border-gray-800 rounded-lg">
                            No recent calls found.
                        </div>
                    ) : (
                        recentCalls.map((call) => (
                            <div key={call.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-colors group">
                                <div className="space-y-1 min-w-0">
                                    <div className="text-sm font-medium text-white truncate group-hover:text-rose-400 transition-colors">
                                        {call.client_name || 'Prospect'}
                                    </div>
                                    <div className="text-[10px] text-gray-500 flex items-center">
                                        <Calendar className="h-3 w-3 mr-1" />
                                        {new Date(call.created_at).toLocaleDateString()}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {call.score !== null && call.score !== undefined && (
                                        <span className={cn(
                                            "text-xs font-bold px-1.5 py-0.5 rounded",
                                            call.score >= 80 ? "bg-emerald-500/10 text-emerald-500" :
                                                call.score >= 60 ? "bg-yellow-500/10 text-yellow-500" :
                                                    "bg-red-500/10 text-red-500"
                                        )}>
                                            {call.score}
                                        </span>
                                    )}
                                    <Link href="/sales">
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-500 hover:text-white">
                                            <FileText className="h-3.5 w-3.5" />
                                        </Button>
                                    </Link>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
