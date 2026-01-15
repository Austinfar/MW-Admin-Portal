import { getTemplateTasks } from '@/lib/actions/onboarding'
import { TemplateTasksManager } from '@/components/onboarding/TemplateTasksManager'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'

interface PageProps {
    params: Promise<{
        templateId: string
    }>
}

async function getTemplate(id: string) {
    const supabase = await createClient()
    const { data } = await supabase
        .from('onboarding_templates')
        .select('*')
        .eq('id', id)
        .single()

    return data
}

export default async function TemplateDetailsPage({ params }: PageProps) {
    const { templateId } = await params
    const template = await getTemplate(templateId)

    if (!template) {
        notFound()
    }

    const tasks = await getTemplateTasks(templateId)

    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center space-x-2">
                <Link href="/onboarding/templates">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div className="flex-1">
                    <h2 className="text-2xl font-bold tracking-tight">{template.name}</h2>
                    <p className="text-muted-foreground">
                        {template.description || 'Manage tasks for this template.'}
                    </p>
                </div>
            </div>

            <TemplateTasksManager
                templateId={templateId}
                initialTasks={tasks}
            />
        </div>
    )
}
