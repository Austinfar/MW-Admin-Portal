'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Save, Loader2, Check } from 'lucide-react'
import { updateLeadNotes } from '@/lib/actions/lead-actions'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'

interface LeadNotesEditorProps {
    leadId: string
    initialNotes: string | null
    updatedAt: string
}

export function LeadNotesEditor({ leadId, initialNotes, updatedAt }: LeadNotesEditorProps) {
    const [notes, setNotes] = useState(initialNotes || '')
    const [isSaving, setIsSaving] = useState(false)
    const [hasChanges, setHasChanges] = useState(false)
    const [lastSaved, setLastSaved] = useState<Date | null>(null)
    const [justSaved, setJustSaved] = useState(false)

    // Track changes
    useEffect(() => {
        setHasChanges(notes !== (initialNotes || ''))
    }, [notes, initialNotes])

    // Reset justSaved after animation
    useEffect(() => {
        if (justSaved) {
            const timer = setTimeout(() => setJustSaved(false), 2000)
            return () => clearTimeout(timer)
        }
    }, [justSaved])

    const handleSave = useCallback(async () => {
        if (!hasChanges || isSaving) return

        setIsSaving(true)
        const result = await updateLeadNotes(leadId, notes)

        if (result.error) {
            toast.error(`Failed to save: ${result.error}`)
        } else {
            setLastSaved(new Date())
            setHasChanges(false)
            setJustSaved(true)
            toast.success('Notes saved')
        }
        setIsSaving(false)
    }, [leadId, notes, hasChanges, isSaving])

    // Keyboard shortcut: Cmd/Ctrl + S to save
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                e.preventDefault()
                handleSave()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [handleSave])

    const savedTimeAgo = lastSaved
        ? formatDistanceToNow(lastSaved, { addSuffix: true })
        : updatedAt
            ? formatDistanceToNow(new Date(updatedAt), { addSuffix: true })
            : null

    return (
        <Card className="bg-card/40 border-primary/5 backdrop-blur-sm h-full">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-base">Notes</CardTitle>
                        <CardDescription className="text-xs">
                            {savedTimeAgo && !hasChanges && (
                                <span className="text-zinc-500">
                                    {justSaved ? (
                                        <span className="text-green-500 flex items-center gap-1">
                                            <Check className="h-3 w-3" /> Saved
                                        </span>
                                    ) : (
                                        `Last saved ${savedTimeAgo}`
                                    )}
                                </span>
                            )}
                            {hasChanges && (
                                <span className="text-amber-500">Unsaved changes</span>
                            )}
                        </CardDescription>
                    </div>
                    <Button
                        size="sm"
                        onClick={handleSave}
                        disabled={!hasChanges || isSaving}
                        className="h-8"
                    >
                        {isSaving ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                        ) : (
                            <Save className="h-3.5 w-3.5 mr-1.5" />
                        )}
                        Save
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add notes about this lead... (Cmd+S to save)"
                    className="min-h-[200px] bg-zinc-900/50 border-zinc-800 resize-none focus:border-primary/30"
                />
            </CardContent>
        </Card>
    )
}
