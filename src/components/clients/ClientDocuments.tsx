'use client'

import { useState, useTransition, useRef } from 'react'
import { FileText, Upload, Download, Trash2, Share2, MoreHorizontal, File, Image, FileSpreadsheet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { ClientDocument, DocumentType } from '@/types/client'
import { createDocumentRecord, deleteDocument, getDocumentDownloadUrl, toggleShareWithClient } from '@/lib/actions/documents'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

interface ClientDocumentsProps {
    clientId: string
    documents: ClientDocument[]
}

const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
    meal_plan: 'Meal Plan',
    workout_program: 'Workout Program',
    intake_form: 'Intake Form',
    contract: 'Contract',
    other: 'Other',
}

const DOCUMENT_TYPE_COLORS: Record<DocumentType, string> = {
    meal_plan: 'bg-green-500/15 text-green-500',
    workout_program: 'bg-blue-500/15 text-blue-500',
    intake_form: 'bg-purple-500/15 text-purple-500',
    contract: 'bg-amber-500/15 text-amber-500',
    other: 'bg-gray-500/15 text-gray-500',
}

function getFileIcon(mimeType: string | null | undefined) {
    if (!mimeType) return File
    if (mimeType.startsWith('image/')) return Image
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return FileSpreadsheet
    if (mimeType.includes('pdf')) return FileText
    return File
}

function formatFileSize(bytes: number | null | undefined) {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function ClientDocuments({ clientId, documents }: ClientDocumentsProps) {
    const [isUploadOpen, setIsUploadOpen] = useState(false)
    const [isPending, startTransition] = useTransition()

    const handleDownload = async (doc: ClientDocument) => {
        startTransition(async () => {
            const result = await getDocumentDownloadUrl(doc.id)
            if (result.error) {
                toast.error('Failed to get download link')
            } else if (result.url) {
                // Open in new tab for download
                window.open(result.url, '_blank')
            }
        })
    }

    const handleDelete = (docId: string) => {
        startTransition(async () => {
            const result = await deleteDocument(docId)
            if (result.error) {
                toast.error('Failed to delete document')
            } else {
                toast.success('Document deleted')
            }
        })
    }

    const handleToggleShare = (docId: string) => {
        startTransition(async () => {
            const result = await toggleShareWithClient(docId)
            if (result.error) {
                toast.error('Failed to update share status')
            } else {
                toast.success(result.isShared ? 'Document shared with client' : 'Document unshared')
            }
        })
    }

    // Group documents by type
    const groupedDocs = documents.reduce((acc, doc) => {
        const type = doc.document_type
        if (!acc[type]) acc[type] = []
        acc[type].push(doc)
        return acc
    }, {} as Record<DocumentType, ClientDocument[]>)

    return (
        <div className="h-full flex flex-col">
            <div className="flex items-center justify-between shrink-0 mb-4">
                <h3 className="text-sm font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    Documents ({documents.length})
                </h3>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsUploadOpen(true)}
                    className="h-8"
                >
                    <Upload className="h-4 w-4 mr-1" />
                    Upload
                </Button>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin">
                {documents.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
                        <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No documents uploaded yet</p>
                        <Button
                            variant="link"
                            size="sm"
                            onClick={() => setIsUploadOpen(true)}
                            className="mt-2"
                        >
                            Upload your first document
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {Object.entries(groupedDocs).map(([type, docs]) => (
                            <div key={type} className="space-y-2">
                                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    {DOCUMENT_TYPE_LABELS[type as DocumentType]}
                                </h4>
                                <div className="space-y-1">
                                    {docs.map((doc) => (
                                        <DocumentItem
                                            key={doc.id}
                                            document={doc}
                                            onDownload={() => handleDownload(doc)}
                                            onDelete={() => handleDelete(doc.id)}
                                            onToggleShare={() => handleToggleShare(doc.id)}
                                            disabled={isPending}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Upload Dialog */}
            <UploadDialog
                clientId={clientId}
                open={isUploadOpen}
                onClose={() => setIsUploadOpen(false)}
            />
        </div>
    )
}

interface DocumentItemProps {
    document: ClientDocument
    onDownload: () => void
    onDelete: () => void
    onToggleShare: () => void
    disabled?: boolean
}

function DocumentItem({ document: doc, onDownload, onDelete, onToggleShare, disabled }: DocumentItemProps) {
    const Icon = getFileIcon(doc.mime_type)

    return (
        <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors group">
            <div className="p-2 rounded bg-muted">
                <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{doc.name}</span>
                    {doc.is_shared_with_client && (
                        <span title="Shared with client">
                            <Share2 className="h-3 w-3 text-blue-500 shrink-0" />
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {doc.file_size && (
                        <>
                            <span>{formatFileSize(doc.file_size)}</span>
                            <span>•</span>
                        </>
                    )}
                    <span>{format(new Date(doc.created_at), 'MMM d, yyyy')}</span>
                    {doc.uploader && (
                        <>
                            <span>•</span>
                            <span>by {doc.uploader.name}</span>
                        </>
                    )}
                </div>
            </div>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100"
                        disabled={disabled}
                    >
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={onDownload}>
                        <Download className="h-4 w-4 mr-2" />
                        Download
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onToggleShare}>
                        <Share2 className="h-4 w-4 mr-2" />
                        {doc.is_shared_with_client ? 'Unshare' : 'Share with client'}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onDelete} className="text-red-600">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    )
}

interface UploadDialogProps {
    clientId: string
    open: boolean
    onClose: () => void
}

function UploadDialog({ clientId, open, onClose }: UploadDialogProps) {
    const [isPending, startTransition] = useTransition()
    const [file, setFile] = useState<File | null>(null)
    const [documentType, setDocumentType] = useState<DocumentType>('other')
    const [description, setDescription] = useState('')
    const [isUploading, setIsUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0]
        if (selectedFile) {
            setFile(selectedFile)
        }
    }

    const handleUpload = async () => {
        if (!file) return

        setIsUploading(true)

        try {
            // Upload file directly from client side
            const supabase = createClient()
            const fileExt = file.name.split('.').pop()
            const fileName = `${clientId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('client-documents')
                .upload(fileName, file)

            if (uploadError) {
                throw new Error(uploadError.message)
            }

            // Create database record via server action
            const result = await createDocumentRecord(clientId, {
                name: file.name,
                description: description || undefined,
                document_type: documentType,
                storage_path: uploadData.path,
                file_size: file.size,
                mime_type: file.type,
            })

            if (result.error) {
                // Try to clean up the uploaded file
                await supabase.storage.from('client-documents').remove([fileName])
                throw new Error(result.error)
            }

            toast.success('Document uploaded')
            onClose()
            setFile(null)
            setDescription('')
            setDocumentType('other')
        } catch (error: any) {
            toast.error('Failed to upload document', { description: error.message })
        } finally {
            setIsUploading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Upload Document</DialogTitle>
                    <DialogDescription>
                        Upload a document for this client
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    {/* File input */}
                    <div className="space-y-2">
                        <Label>File</Label>
                        <div
                            className={cn(
                                'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors',
                                file && 'border-primary bg-primary/5'
                            )}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {file ? (
                                <div className="flex items-center justify-center gap-2">
                                    <FileText className="h-5 w-5 text-primary" />
                                    <span className="text-sm font-medium">{file.name}</span>
                                    <span className="text-xs text-muted-foreground">
                                        ({formatFileSize(file.size)})
                                    </span>
                                </div>
                            ) : (
                                <div className="text-muted-foreground">
                                    <Upload className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">Click to select a file</p>
                                    <p className="text-xs">or drag and drop</p>
                                </div>
                            )}
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            className="hidden"
                            onChange={handleFileChange}
                        />
                    </div>

                    {/* Document type */}
                    <div className="space-y-2">
                        <Label>Document Type</Label>
                        <Select value={documentType} onValueChange={(v) => setDocumentType(v as DocumentType)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="meal_plan">Meal Plan</SelectItem>
                                <SelectItem value="workout_program">Workout Program</SelectItem>
                                <SelectItem value="intake_form">Intake Form</SelectItem>
                                <SelectItem value="contract">Contract</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <Label>Description (optional)</Label>
                        <Textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Add notes about this document..."
                            rows={2}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button onClick={handleUpload} disabled={!file || isUploading}>
                        {isUploading ? 'Uploading...' : 'Upload'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
