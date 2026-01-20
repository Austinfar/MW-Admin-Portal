'use client'

import { useState, useCallback, useRef } from 'react'
import { Upload, X, Image as ImageIcon, Loader2, Clipboard } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

interface ScreenshotUploadProps {
    value: string[]
    onChange: (urls: string[]) => void
    maxFiles?: number
    disabled?: boolean
}

export function ScreenshotUpload({
    value = [],
    onChange,
    maxFiles = 5,
    disabled = false,
}: ScreenshotUploadProps) {
    const [isUploading, setIsUploading] = useState(false)
    const [isDragOver, setIsDragOver] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    const uploadFile = async (file: File): Promise<string | null> => {
        const supabase = createClient()

        // Validate file
        if (!file.type.startsWith('image/')) {
            toast.error('Only image files are allowed')
            return null
        }

        if (file.size > 5 * 1024 * 1024) {
            toast.error('File size must be less than 5MB')
            return null
        }

        // Generate unique filename
        const ext = file.name.split('.').pop() || 'png'
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`
        const filePath = `feature-requests/${fileName}`

        // Upload to Supabase Storage
        const { error } = await supabase.storage
            .from('screenshots')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false,
            })

        if (error) {
            console.error('Upload error:', error)
            toast.error('Failed to upload image')
            return null
        }

        // Get public URL
        const { data: urlData } = supabase.storage
            .from('screenshots')
            .getPublicUrl(filePath)

        return urlData.publicUrl
    }

    const handleFiles = async (files: FileList | File[]) => {
        const fileArray = Array.from(files)
        const remainingSlots = maxFiles - value.length

        if (fileArray.length > remainingSlots) {
            toast.warning(`You can only upload ${remainingSlots} more file(s)`)
            fileArray.splice(remainingSlots)
        }

        if (fileArray.length === 0) return

        setIsUploading(true)

        try {
            const uploadPromises = fileArray.map(uploadFile)
            const urls = await Promise.all(uploadPromises)
            const successfulUploads = urls.filter((url): url is string => url !== null)

            if (successfulUploads.length > 0) {
                onChange([...value, ...successfulUploads])
                toast.success(`Uploaded ${successfulUploads.length} screenshot(s)`)
            }
        } finally {
            setIsUploading(false)
        }
    }

    const handleDrop = useCallback(
        async (e: React.DragEvent) => {
            e.preventDefault()
            setIsDragOver(false)

            if (disabled || isUploading) return

            const files = e.dataTransfer.files
            await handleFiles(files)
        },
        [disabled, isUploading, value, maxFiles, onChange]
    )

    const handlePaste = useCallback(
        async (e: React.ClipboardEvent) => {
            if (disabled || isUploading) return

            const items = e.clipboardData.items
            const imageFiles: File[] = []

            for (let i = 0; i < items.length; i++) {
                if (items[i].type.startsWith('image/')) {
                    const file = items[i].getAsFile()
                    if (file) imageFiles.push(file)
                }
            }

            if (imageFiles.length > 0) {
                e.preventDefault()
                await handleFiles(imageFiles)
            }
        },
        [disabled, isUploading, value, maxFiles, onChange]
    )

    const removeImage = (index: number) => {
        const newUrls = [...value]
        newUrls.splice(index, 1)
        onChange(newUrls)
    }

    return (
        <div className="space-y-3" onPaste={handlePaste}>
            {/* Existing images */}
            {value.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {value.map((url, index) => (
                        <div
                            key={url}
                            className="relative group rounded-lg overflow-hidden border bg-muted"
                        >
                            <img
                                src={url}
                                alt={`Screenshot ${index + 1}`}
                                className="h-20 w-20 object-cover"
                            />
                            <button
                                type="button"
                                onClick={() => removeImage(index)}
                                className="absolute top-1 right-1 p-0.5 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                                disabled={disabled}
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Upload area */}
            {value.length < maxFiles && (
                <div
                    onDragOver={(e) => {
                        e.preventDefault()
                        if (!disabled && !isUploading) setIsDragOver(true)
                    }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={handleDrop}
                    className={cn(
                        "border-2 border-dashed rounded-lg p-4 text-center transition-colors",
                        isDragOver && "border-neon-green bg-neon-green/5",
                        !isDragOver && "border-muted-foreground/25 hover:border-muted-foreground/50",
                        (disabled || isUploading) && "opacity-50 cursor-not-allowed"
                    )}
                >
                    <input
                        ref={inputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => e.target.files && handleFiles(e.target.files)}
                        className="hidden"
                        disabled={disabled || isUploading}
                    />

                    {isUploading ? (
                        <div className="flex items-center justify-center gap-2 text-muted-foreground">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span className="text-sm">Uploading...</span>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <div className="flex items-center justify-center gap-2 text-muted-foreground">
                                <ImageIcon className="h-5 w-5" />
                                <span className="text-sm">Drag & drop images here</span>
                            </div>
                            <div className="flex items-center justify-center gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => inputRef.current?.click()}
                                    disabled={disabled}
                                >
                                    <Upload className="h-4 w-4 mr-1" />
                                    Browse
                                </Button>
                                <span className="text-xs text-muted-foreground">or</span>
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Clipboard className="h-3 w-3" />
                                    Paste (Ctrl+V)
                                </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {value.length}/{maxFiles} images • Max 5MB each
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
