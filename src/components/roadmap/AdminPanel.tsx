'use client'

import { useState } from 'react'
import { PlusCircle, Trash2, Tag, Target, BarChart3, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { AnalyticsDashboard } from './AnalyticsDashboard'

import {
    createTag,
    deleteTag,
    createMilestone,
    updateMilestone,
    createAnnouncement,
} from '@/lib/actions/feature-requests'
import type { FeatureTag, Milestone, RoadmapStats } from '@/types/roadmap'

interface AdminPanelProps {
    tags: FeatureTag[]
    milestones: Milestone[]
    stats: RoadmapStats
}

export function AdminPanel({ tags: initialTags, milestones: initialMilestones, stats }: AdminPanelProps) {
    const [tags, setTags] = useState(initialTags)
    const [milestones, setMilestones] = useState(initialMilestones)

    return (
        <div className="space-y-6">
            <Tabs defaultValue="analytics" className="space-y-6">
                <TabsList>
                    <TabsTrigger value="analytics" className="gap-2">
                        <BarChart3 className="h-4 w-4" />
                        Analytics
                    </TabsTrigger>
                    <TabsTrigger value="management" className="gap-2">
                        <Tag className="h-4 w-4" />
                        Management
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="analytics">
                    <AnalyticsDashboard stats={stats} />
                </TabsContent>

                <TabsContent value="management" className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Tag Manager */}
                        <TagManager tags={tags} onTagsChange={setTags} />

                        {/* Milestone Manager */}
                        <MilestoneManager milestones={milestones} onMilestonesChange={setMilestones} />
                    </div>

                    {/* Announcements */}
                    <AnnouncementCreator />
                </TabsContent>
            </Tabs>
        </div>
    )
}

function StatBox({ label, value }: { label: string; value: string | number }) {
    return (
        <div className="text-center p-4 bg-muted/50 rounded-lg">
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
        </div>
    )
}

function TagManager({
    tags,
    onTagsChange,
}: {
    tags: FeatureTag[]
    onTagsChange: (tags: FeatureTag[]) => void
}) {
    const [isCreating, setIsCreating] = useState(false)
    const [newTagName, setNewTagName] = useState('')
    const [newTagColor, setNewTagColor] = useState('#22c55e')
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleCreate = async () => {
        if (!newTagName.trim()) return
        setIsSubmitting(true)

        try {
            const result = await createTag(newTagName, newTagColor)
            if (result.error) {
                toast.error(result.error)
            } else if (result.data) {
                onTagsChange([...tags, result.data])
                setNewTagName('')
                setNewTagColor('#22c55e')
                setIsCreating(false)
                toast.success('Tag created')
            }
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleDelete = async (id: string) => {
        const result = await deleteTag(id)
        if (result.success) {
            onTagsChange(tags.filter(t => t.id !== id))
            toast.success('Tag deleted')
        } else {
            toast.error(result.error || 'Failed to delete')
        }
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Tag className="h-5 w-5" />
                            Tags
                        </CardTitle>
                        <CardDescription>Manage tags for categorizing requests</CardDescription>
                    </div>
                    <Dialog open={isCreating} onOpenChange={setIsCreating}>
                        <DialogTrigger asChild>
                            <Button size="sm">
                                <PlusCircle className="h-4 w-4 mr-1" />
                                New Tag
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Create Tag</DialogTitle>
                                <DialogDescription>
                                    Create a new tag to categorize feature requests.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label>Name</Label>
                                    <Input
                                        placeholder="e.g., quick-win, needs-design"
                                        value={newTagName}
                                        onChange={(e) => setNewTagName(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Color</Label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="color"
                                            value={newTagColor}
                                            onChange={(e) => setNewTagColor(e.target.value)}
                                            className="w-10 h-10 rounded cursor-pointer"
                                        />
                                        <Input
                                            value={newTagColor}
                                            onChange={(e) => setNewTagColor(e.target.value)}
                                            className="flex-1"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <Label>Preview</Label>
                                    <div className="mt-2">
                                        <Badge style={{ backgroundColor: newTagColor + '20', color: newTagColor, borderColor: newTagColor + '40' }}>
                                            {newTagName || 'Tag Name'}
                                        </Badge>
                                    </div>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsCreating(false)}>
                                    Cancel
                                </Button>
                                <Button onClick={handleCreate} disabled={!newTagName.trim() || isSubmitting}>
                                    {isSubmitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                                    Create Tag
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </CardHeader>
            <CardContent>
                {tags.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                        No tags created yet.
                    </p>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {tags.map((tag) => (
                            <div key={tag.id} className="group relative">
                                <Badge
                                    style={{
                                        backgroundColor: tag.color + '20',
                                        color: tag.color,
                                        borderColor: tag.color + '40',
                                    }}
                                    className="pr-6"
                                >
                                    {tag.name}
                                </Badge>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="absolute -right-1 -top-1 h-4 w-4 rounded-full opacity-0 group-hover:opacity-100 bg-destructive hover:bg-destructive/90"
                                        >
                                            <Trash2 className="h-2.5 w-2.5 text-destructive-foreground" />
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Delete Tag</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Are you sure you want to delete "{tag.name}"? This will remove it from all requests.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDelete(tag.id)}>
                                                Delete
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

function MilestoneManager({
    milestones,
    onMilestonesChange,
}: {
    milestones: Milestone[]
    onMilestonesChange: (milestones: Milestone[]) => void
}) {
    const [isCreating, setIsCreating] = useState(false)
    const [newName, setNewName] = useState('')
    const [newDescription, setNewDescription] = useState('')
    const [newTargetDate, setNewTargetDate] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleCreate = async () => {
        if (!newName.trim()) return
        setIsSubmitting(true)

        try {
            const result = await createMilestone(
                newName,
                newDescription || undefined,
                newTargetDate || undefined
            )
            if (result.error) {
                toast.error(result.error)
            } else if (result.data) {
                onMilestonesChange([...milestones, result.data])
                setNewName('')
                setNewDescription('')
                setNewTargetDate('')
                setIsCreating(false)
                toast.success('Milestone created')
            }
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleToggleComplete = async (milestone: Milestone) => {
        const result = await updateMilestone(milestone.id, { is_completed: !milestone.is_completed })
        if (result.success) {
            onMilestonesChange(
                milestones.map(m =>
                    m.id === milestone.id ? { ...m, is_completed: !m.is_completed } : m
                )
            )
            toast.success(milestone.is_completed ? 'Milestone reopened' : 'Milestone completed')
        } else {
            toast.error(result.error || 'Failed to update')
        }
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Target className="h-5 w-5" />
                            Milestones
                        </CardTitle>
                        <CardDescription>Group features into releases</CardDescription>
                    </div>
                    <Dialog open={isCreating} onOpenChange={setIsCreating}>
                        <DialogTrigger asChild>
                            <Button size="sm">
                                <PlusCircle className="h-4 w-4 mr-1" />
                                New Milestone
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Create Milestone</DialogTitle>
                                <DialogDescription>
                                    Create a milestone to group related features.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label>Name *</Label>
                                    <Input
                                        placeholder="e.g., V2.0 Release, Q1 2026"
                                        value={newName}
                                        onChange={(e) => setNewName(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Description</Label>
                                    <Input
                                        placeholder="Brief description (optional)"
                                        value={newDescription}
                                        onChange={(e) => setNewDescription(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Target Date</Label>
                                    <Input
                                        type="date"
                                        value={newTargetDate}
                                        onChange={(e) => setNewTargetDate(e.target.value)}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsCreating(false)}>
                                    Cancel
                                </Button>
                                <Button onClick={handleCreate} disabled={!newName.trim() || isSubmitting}>
                                    {isSubmitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                                    Create Milestone
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </CardHeader>
            <CardContent>
                {milestones.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                        No milestones created yet.
                    </p>
                ) : (
                    <div className="space-y-2">
                        {milestones.map((milestone) => (
                            <div
                                key={milestone.id}
                                className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                            >
                                <div>
                                    <p className={`font-medium ${milestone.is_completed ? 'line-through text-muted-foreground' : ''}`}>
                                        {milestone.name}
                                    </p>
                                    {milestone.target_date && (
                                        <p className="text-xs text-muted-foreground">
                                            Target: {new Date(milestone.target_date).toLocaleDateString()}
                                        </p>
                                    )}
                                </div>
                                <Button
                                    variant={milestone.is_completed ? "outline" : "default"}
                                    size="sm"
                                    onClick={() => handleToggleComplete(milestone)}
                                >
                                    {milestone.is_completed ? 'Reopen' : 'Complete'}
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

function AnnouncementCreator() {
    const [isCreating, setIsCreating] = useState(false)
    const [title, setTitle] = useState('')
    const [content, setContent] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleCreate = async () => {
        if (!title.trim() || !content.trim()) return
        setIsSubmitting(true)

        try {
            const result = await createAnnouncement(title, content)
            if (result.error) {
                toast.error(result.error)
            } else {
                setTitle('')
                setContent('')
                setIsCreating(false)
                toast.success('Announcement posted')
            }
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Announcements</CardTitle>
                        <CardDescription>Post updates visible to all users</CardDescription>
                    </div>
                    <Dialog open={isCreating} onOpenChange={setIsCreating}>
                        <DialogTrigger asChild>
                            <Button size="sm">
                                <PlusCircle className="h-4 w-4 mr-1" />
                                New Announcement
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Create Announcement</DialogTitle>
                                <DialogDescription>
                                    This will be shown at the top of the roadmap page.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label>Title *</Label>
                                    <Input
                                        placeholder="e.g., New Feature Released!"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Content *</Label>
                                    <Input
                                        placeholder="Brief message..."
                                        value={content}
                                        onChange={(e) => setContent(e.target.value)}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsCreating(false)}>
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleCreate}
                                    disabled={!title.trim() || !content.trim() || isSubmitting}
                                >
                                    {isSubmitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                                    Post Announcement
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </CardHeader>
        </Card>
    )
}
