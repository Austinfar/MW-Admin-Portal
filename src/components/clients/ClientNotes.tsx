'use client'

import { useState } from 'react'
import { Note } from '@/types/client'
import { createNote, deleteNote, togglePinNote, updateNote } from '@/lib/actions/notes'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Check, Pin, PinOff, Trash2, Plus, Loader2, Pencil, X } from 'lucide-react'
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
    const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
    const [editContent, setEditContent] = useState('')

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

    const handleStartEdit = (note: Note) => {
        setEditingNoteId(note.id)
        setEditContent(note.content)
    }

    const handleCancelEdit = () => {
        setEditingNoteId(null)
        setEditContent('')
    }

    const handleSaveEdit = async () => {
        if (!editContent.trim() || !editingNoteId) return

        try {
            await updateNote(editingNoteId, clientId, editContent)
            toast.success('Note updated')
            setEditingNoteId(null)
            setEditContent('')
        } catch (error) {
            toast.error('Failed to update note')
        }
    }

    return (
        <Card className="bg-card/50 backdrop-blur-xl border-white/5 hover:border-primary/20 transition-all duration-300 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)] h-full flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between pb-4 shrink-0">
                <div>
                    <CardTitle>Notes</CardTitle>
                    <CardDescription>Internal team notes. (2-way sync with GHL @sarah ;))</CardDescription>
                </div>
                {!isAdding && (
                    <Button size="sm" onClick={() => setIsAdding(true)} variant="outline" className="bg-card/50 backdrop-blur-sm border-white/10 hover:border-primary/30 hover:bg-primary/10 transition-all duration-200">
                        <Plus className="h-4 w-4 mr-1" /> Add Note
                    </Button>
                )}
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto space-y-4 scrollbar-thin">
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
                                "group rounded-xl p-4 border transition-all duration-200",
                                note.is_pinned
                                    ? "bg-primary/10 border-primary/20 backdrop-blur-sm shadow-[0_0_15px_var(--glow-primary)]"
                                    : "bg-white/5 border-white/5 hover:border-white/10 hover:bg-white/10"
                            )}
                        >
                            <div className="flex justify-between items-start gap-4 mb-2">
                                <div className="flex items-center gap-2">
                                    <Avatar className="h-6 w-6">
                                        <AvatarImage src={note.author?.avatar_url || ''} />
                                        <AvatarFallback className="text-[10px]">
                                            {note.author?.name?.substring(0, 2).toUpperCase() || '??'}
                                        </AvatarFallback>
                                    </Avatar>
                                    <span className="text-xs font-medium opacity-70">
                                        {note.author?.name || 'Unknown'}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground" suppressHydrationWarning>
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
                                        className="h-6 w-6 text-muted-foreground hover:text-primary"
                                        onClick={() => handleStartEdit(note)}
                                        title="Edit"
                                        disabled={!!editingNoteId}
                                    >
                                        <Pencil className="h-3 w-3" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                        onClick={() => handleDelete(note.id)}
                                        title="Delete"
                                        disabled={!!editingNoteId}
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </Button>
                                </div>
                            </div>
                            {editingNoteId === note.id ? (
                                <div className="space-y-2 mt-2">
                                    <Textarea
                                        value={editContent}
                                        onChange={(e) => setEditContent(e.target.value)}
                                        className="min-h-[100px] resize-none bg-background"
                                        autoFocus
                                    />
                                    <div className="flex justify-end gap-2">
                                        <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
                                            <X className="h-3 w-3 mr-1" />
                                            Cancel
                                        </Button>
                                        <Button size="sm" onClick={handleSaveEdit} disabled={!editContent.trim()}>
                                            <Check className="h-3 w-3 mr-1" />
                                            vSave
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm whitespace-pre-wrap leading-relaxed text-foreground/90 pl-1">
                                    {note.content}
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}
