'use client'

import { useState } from 'react'
import { Note } from '@/types/client'
import { createNote, deleteNote, togglePinNote } from '@/lib/actions/notes'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Check, Pin, PinOff, Trash2, Plus, Loader2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface ClientNotesProps {
    notes: Note[]
    clientId: string
}

export function ClientNotes({ notes, clientId }: ClientNotesProps) {
    const [isAdding, setIsAdding] = useState(false)
    const [newNoteContent, setNewNoteContent] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleAddNote = async () => {
        if (!newNoteContent.trim()) return

        setIsSubmitting(true)
        try {
            await createNote(clientId, newNoteContent)
            setNewNoteContent('')
            setIsAdding(false)
            toast.success('Note added')
        } catch (error) {
            toast.error('Failed to add note')
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleDelete = async (noteId: string) => {
        try {
            await deleteNote(noteId, clientId)
            toast.success('Note deleted')
        } catch (error) {
            toast.error('Failed to delete note')
        }
    }

    const handleTogglePin = async (noteId: string, currentStatus: boolean) => {
        try {
            await togglePinNote(noteId, clientId, currentStatus)
            toast.success(currentStatus ? 'Note unpinned' : 'Note pinned')
        } catch (error) {
            toast.error('Failed to update note')
        }
    }

    return (
        <Card className="bg-card/40 border-primary/5 backdrop-blur-sm h-full flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
                <div>
                    <CardTitle>Notes</CardTitle>
                    <CardDescription>Internal team notes.</CardDescription>
                </div>
                {!isAdding && (
                    <Button size="sm" onClick={() => setIsAdding(true)} variant="outline">
                        <Plus className="h-4 w-4 mr-1" /> Add Note
                    </Button>
                )}
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                {isAdding && (
                    <div className="bg-background/50 border rounded-lg p-3 space-y-3 animate-in fade-in slide-in-from-top-2">
                        <Textarea
                            placeholder="Type your note here..."
                            value={newNoteContent}
                            onChange={(e) => setNewNoteContent(e.target.value)}
                            className="min-h-[100px] resize-none"
                            autoFocus
                        />
                        <div className="flex justify-end gap-2">
                            <Button size="sm" variant="ghost" onClick={() => setIsAdding(false)} disabled={isSubmitting}>
                                Cancel
                            </Button>
                            <Button size="sm" onClick={handleAddNote} disabled={!newNoteContent.trim() || isSubmitting}>
                                {isSubmitting && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                                Save Note
                            </Button>
                        </div>
                    </div>
                )}

                {notes.length === 0 && !isAdding && (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                        No notes yet. Add one to get started.
                    </div>
                )}

                <div className="space-y-3">
                    {notes.map((note) => (
                        <div
                            key={note.id}
                            className={cn(
                                "group bg-muted/30 rounded-lg p-4 border transition-all hover:bg-muted/50",
                                note.is_pinned ? "border-primary/20 bg-primary/5" : "border-transparent"
                            )}
                        >
                            <div className="flex justify-between items-start gap-4 mb-2">
                                <div className="flex items-center gap-2">
                                    <Avatar className="h-6 w-6">
                                        <AvatarFallback className="text-[10px]">
                                            {note.author?.name?.substring(0, 2).toUpperCase() || '??'}
                                        </AvatarFallback>
                                    </Avatar>
                                    <span className="text-xs font-medium opacity-70">
                                        {note.author?.name || 'Unknown'}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground">
                                        {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
                                    </span>
                                </div>
                                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-muted-foreground hover:text-primary"
                                        onClick={() => handleTogglePin(note.id, note.is_pinned)}
                                        title={note.is_pinned ? "Unpin" : "Pin"}
                                    >
                                        {note.is_pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                        onClick={() => handleDelete(note.id)}
                                        title="Delete"
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </Button>
                                </div>
                            </div>
                            <p className="text-sm whitespace-pre-wrap leading-relaxed text-foreground/90 pl-1">
                                {note.content}
                            </p>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}
