'use client'

import { useState } from 'react'
import { ClientType } from '@/types/client'
import { OnboardingTemplate } from '@/types/onboarding'
import { createClientType, toggleClientTypeStatus, deleteClientType } from '@/lib/actions/settings'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

interface ClientTypesManagerProps {
    initialTypes: ClientType[]
    onboardingTemplates: OnboardingTemplate[]
}

export function ClientTypesManager({ initialTypes, onboardingTemplates }: ClientTypesManagerProps) {
    const [open, setOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)

    async function handleAddType(formData: FormData) {
        setIsLoading(true)
        const name = formData.get('name') as string
        const description = formData.get('description') as string
        const templateId = formData.get('default_onboarding_template_id') as string

        const result = await createClientType(name, description, templateId)
        setIsLoading(false)

        if (result.error) {
            toast.error(result.error)
        } else {
            toast.success('Client Type added')
            setOpen(false)
        }
    }

    async function handleToggle(id: string, currentStatus: boolean) {
        const result = await toggleClientTypeStatus(id, currentStatus)
        if (result.error) {
            toast.error(result.error)
        } else {
            toast.success('Status updated')
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('Are you sure you want to delete this type?')) return

        const result = await deleteClientType(id)
        if (result.error) {
            toast.error(result.error)
        } else {
            toast.success('Client Type deleted')
        }
    }

    return (
        <Card className="bg-card/40 border-primary/5">
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Client Types</CardTitle>
                    <CardDescription>Manage the types of coaching programs available.</CardDescription>
                </div>
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button size="sm">
                            <Plus className="h-4 w-4 mr-2" />
                            Add Type
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add Client Type</DialogTitle>
                            <DialogDescription>Create a new coaching program type.</DialogDescription>
                        </DialogHeader>
                        <form action={handleAddType}>
                            <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="name">Name</Label>
                                    <Input id="name" name="name" placeholder="e.g. VIP Coaching" required />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="description">Description (Optional)</Label>
                                    <Textarea id="description" name="description" placeholder="Brief description of the program..." />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="default_onboarding_template_id">Default Onboarding Template</Label>
                                    <Select name="default_onboarding_template_id">
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a template (Optional)" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">No Template</SelectItem>
                                            {onboardingTemplates.map(t => (
                                                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button type="submit" disabled={isLoading}>
                                    {isLoading ? 'Creating...' : 'Create Type'}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Active</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {initialTypes.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
                                    No client types found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            initialTypes.map((type) => (
                                <TableRow key={type.id}>
                                    <TableCell className="font-medium">{type.name}</TableCell>
                                    <TableCell>{type.description || '-'}</TableCell>
                                    <TableCell>
                                        <Switch
                                            checked={type.is_active}
                                            onCheckedChange={() => handleToggle(type.id, type.is_active)}
                                        />
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                            onClick={() => handleDelete(type.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    )
}
