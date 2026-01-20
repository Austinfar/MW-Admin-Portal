'use client'

import { OnboardingTemplate } from '@/types/onboarding'
import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Settings, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { createOnboardingTemplate, deleteOnboardingTemplate, getOnboardingTemplates } from '@/lib/actions/onboarding'
import { toast } from 'sonner'
import { TaskTemplateManager } from './TaskTemplateManager'

interface TeamUser {
    id: string
    name: string
}

interface OnboardingSettingsProps {
    initialTemplates: OnboardingTemplate[]
    users?: TeamUser[]
}

export function OnboardingSettings({ initialTemplates, users = [] }: OnboardingSettingsProps) {
    const [templates, setTemplates] = useState(initialTemplates)
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
    const [newTemplateName, setNewTemplateName] = useState('')
    const [newTemplateDescription, setNewTemplateDescription] = useState('')
    const [creating, setCreating] = useState(false)
    const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
    const [isTaskManagerOpen, setIsTaskManagerOpen] = useState(false)

    const refreshTemplates = async () => {
        const updated = await getOnboardingTemplates()
        setTemplates(updated)
    }

    const handleCreateTemplate = async () => {
        if (!newTemplateName.trim()) {
            toast.error('Template name is required')
            return
        }

        setCreating(true)
        const formData = new FormData()
        formData.append('name', newTemplateName)
        formData.append('description', newTemplateDescription)

        const res = await createOnboardingTemplate(formData)
        setCreating(false)

        if (res.error) {
            toast.error(res.error)
        } else {
            toast.success('Template created')
            setIsCreateDialogOpen(false)
            setNewTemplateName('')
            setNewTemplateDescription('')
            refreshTemplates()
        }
    }

    const handleDeleteTemplate = async (id: string) => {
        if (!confirm('Are you sure you want to delete this template?')) return

        const res = await deleteOnboardingTemplate(id)
        if (res.error) {
            toast.error(res.error)
        } else {
            toast.success('Template deleted')
            refreshTemplates()
        }
    }

    const handleManageTasks = (templateId: string) => {
        setSelectedTemplateId(templateId)
        setIsTaskManagerOpen(true)
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-medium">Onboarding Templates</h3>
                    <p className="text-sm text-muted-foreground">
                        Manage task lists assigned to new clients.
                    </p>
                </div>
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    New Template
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Templates</CardTitle>
                    <CardDescription>
                        Define standard onboarding procedures for different client types.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {templates.map((template) => (
                                <TableRow key={template.id}>
                                    <TableCell className="font-medium">{template.name}</TableCell>
                                    <TableCell>{template.description || '-'}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleManageTasks(template.id)}
                                            >
                                                <Settings className="h-4 w-4 mr-1" />
                                                Manage Tasks
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-destructive hover:text-destructive"
                                                onClick={() => handleDeleteTemplate(template.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {templates.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={3} className="h-24 text-center">
                                        No templates found. Create one to get started.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Create Template Dialog */}
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create Onboarding Template</DialogTitle>
                        <DialogDescription>
                            Define a new template for client onboarding tasks.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Template Name</Label>
                            <Input
                                id="name"
                                value={newTemplateName}
                                onChange={(e) => setNewTemplateName(e.target.value)}
                                placeholder="e.g., Standard Onboarding"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="description">Description (Optional)</Label>
                            <Textarea
                                id="description"
                                value={newTemplateDescription}
                                onChange={(e) => setNewTemplateDescription(e.target.value)}
                                placeholder="Brief description of this template..."
                                className="h-20"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsCreateDialogOpen(false)} disabled={creating}>
                            Cancel
                        </Button>
                        <Button onClick={handleCreateTemplate} disabled={creating || !newTemplateName.trim()}>
                            {creating ? 'Creating...' : 'Create Template'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Task Manager */}
            <TaskTemplateManager
                templateId={selectedTemplateId}
                isOpen={isTaskManagerOpen}
                onClose={() => {
                    setIsTaskManagerOpen(false)
                    setSelectedTemplateId(null)
                }}
                users={users}
            />
        </div>
    )
}
