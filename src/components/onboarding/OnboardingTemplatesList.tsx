'use client'

import { OnboardingTemplate } from '@/types/onboarding'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Trash2, Edit } from 'lucide-react'
import Link from 'next/link'
import { deleteOnboardingTemplate } from '@/lib/actions/onboarding'
import { toast } from 'sonner' // Assuming sonner is used, if not we'll see errors or use alert fallback in catch
import { useRouter } from 'next/navigation' // For refresh if needed, but actions revalidate

interface OnboardingTemplatesListProps {
    initialTemplates: OnboardingTemplate[]
}

export function OnboardingTemplatesList({ initialTemplates }: OnboardingTemplatesListProps) {

    async function handleDelete(id: string) {
        if (!confirm('Are you sure you want to delete this template?')) return

        const res = await deleteOnboardingTemplate(id)
        if (res.error) {
            alert(res.error)
        } else {
            // Success
        }
    }

    if (initialTemplates.length === 0) {
        return (
            <div className="text-center py-10">
                <p className="text-muted-foreground">No templates found. Create one to get started.</p>
            </div>
        )
    }

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {initialTemplates.map((template) => (
                <Card key={template.id} className="bg-card/50 backdrop-blur-sm border-primary/10 hover:border-primary/30 transition-all duration-300">
                    <CardHeader>
                        <CardTitle className="flex justify-between items-start">
                            <span>{template.name}</span>
                        </CardTitle>
                        <CardDescription>{template.description || 'No description'}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex justify-end gap-2">
                            <Link href={`/onboarding/templates/${template.id}`}>
                                <Button variant="outline" size="sm">
                                    <Edit className="h-4 w-4 mr-2" />
                                    Manage Tasks
                                </Button>
                            </Link>
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDelete(template.id)}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}
