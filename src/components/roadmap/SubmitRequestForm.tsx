'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Loader2, Send } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

import { RichTextEditor } from './RichTextEditor'
import { ScreenshotUpload } from './ScreenshotUpload'
import { RequestTemplates, type RequestTemplate } from './RequestTemplates'

import { createFeatureRequest } from '@/lib/actions/feature-requests'
import {
    CATEGORY_CONFIG,
    TYPE_CONFIG,
    PRIORITY_CONFIG,
    type RequestCategory,
    type RequestType,
    type RequestPriority,
} from '@/types/roadmap'

interface SubmitRequestFormProps {
    onSuccess?: () => void
}

interface FormData {
    title: string
    description: string
    category: RequestCategory
    type: RequestType
    priority: RequestPriority
}

export function SubmitRequestForm({ onSuccess }: SubmitRequestFormProps) {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [screenshots, setScreenshots] = useState<string[]>([])
    const [description, setDescription] = useState('')

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        reset,
        formState: { errors },
    } = useForm<FormData>({
        defaultValues: {
            title: '',
            description: '',
            category: 'general',
            type: 'feature',
            priority: 'medium',
        },
    })

    const selectedCategory = watch('category')
    const selectedType = watch('type')
    const selectedPriority = watch('priority')

    const handleSelectTemplate = (template: RequestTemplate) => {
        setValue('title', template.titlePlaceholder)
        setValue('type', template.type)
        setValue('category', template.category)
        setValue('priority', template.priority)
        setDescription(template.descriptionTemplate)
    }

    const onSubmit = async (data: FormData) => {
        if (!description.trim() || description === '<p></p>') {
            toast.error('Please provide a description')
            return
        }

        setIsSubmitting(true)
        try {
            const result = await createFeatureRequest({
                ...data,
                description,
                screenshot_urls: screenshots,
            })

            if (result.error) {
                toast.error(result.error)
            } else {
                toast.success('Feature request submitted successfully!')
                reset()
                setDescription('')
                setScreenshots([])
                onSuccess?.()
            }
        } catch (error) {
            toast.error('Failed to submit request')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Card className="max-w-2xl mx-auto">
            <CardHeader>
                <div className="flex items-start justify-between">
                    <div>
                        <CardTitle>Submit a Feature Request</CardTitle>
                        <CardDescription>
                            Have an idea to improve the platform? Let us know!
                        </CardDescription>
                    </div>
                    <RequestTemplates onSelectTemplate={handleSelectTemplate} />
                </div>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    {/* Title */}
                    <div className="space-y-2">
                        <Label htmlFor="title">Title *</Label>
                        <Input
                            id="title"
                            placeholder="Brief, descriptive title for your request"
                            {...register('title', { required: 'Title is required' })}
                            disabled={isSubmitting}
                        />
                        {errors.title && (
                            <p className="text-sm text-destructive">{errors.title.message}</p>
                        )}
                    </div>

                    {/* Description with Rich Text */}
                    <div className="space-y-2">
                        <Label>Description *</Label>
                        <RichTextEditor
                            content={description}
                            onChange={setDescription}
                            placeholder="Describe your request in detail. What problem does it solve? How would you use it?"
                            disabled={isSubmitting}
                            minHeight="150px"
                        />
                        <p className="text-xs text-muted-foreground">
                            Use formatting to organize your thoughts: headings, lists, code blocks, etc.
                        </p>
                    </div>

                    {/* Category & Type Row */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Category</Label>
                            <Select
                                value={selectedCategory}
                                onValueChange={(value) => setValue('category', value as RequestCategory)}
                                disabled={isSubmitting}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                                        <SelectItem key={key} value={key}>
                                            <span className="flex items-center gap-2">
                                                <span>{config.icon}</span>
                                                <span>{config.label}</span>
                                            </span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Type</Label>
                            <Select
                                value={selectedType}
                                onValueChange={(value) => setValue('type', value as RequestType)}
                                disabled={isSubmitting}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(TYPE_CONFIG).map(([key, config]) => (
                                        <SelectItem key={key} value={key}>
                                            <span className="flex items-center gap-2">
                                                <span>{config.icon}</span>
                                                <span>{config.label}</span>
                                            </span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Priority */}
                    <div className="space-y-2">
                        <Label>Suggested Priority</Label>
                        <p className="text-xs text-muted-foreground mb-2">
                            How important is this to you? (Admins may adjust based on overall priorities)
                        </p>
                        <div className="flex gap-2">
                            {Object.entries(PRIORITY_CONFIG).map(([key, config]) => (
                                <Button
                                    key={key}
                                    type="button"
                                    variant={selectedPriority === key ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setValue('priority', key as RequestPriority)}
                                    disabled={isSubmitting}
                                    className={selectedPriority === key ? '' : config.color}
                                >
                                    {config.label}
                                </Button>
                            ))}
                        </div>
                    </div>

                    {/* Screenshots */}
                    <div className="space-y-2">
                        <Label>Screenshots (Optional)</Label>
                        <p className="text-xs text-muted-foreground mb-2">
                            Add screenshots to help illustrate your request
                        </p>
                        <ScreenshotUpload
                            value={screenshots}
                            onChange={setScreenshots}
                            maxFiles={5}
                            disabled={isSubmitting}
                        />
                    </div>

                    {/* Submit Button */}
                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                        {isSubmitting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Submitting...
                            </>
                        ) : (
                            <>
                                <Send className="mr-2 h-4 w-4" />
                                Submit Request
                            </>
                        )}
                    </Button>
                </form>
            </CardContent>
        </Card>
    )
}
