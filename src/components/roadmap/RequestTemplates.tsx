'use client'

import { FileText, Bug, Zap, HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

import type { RequestType, RequestCategory, RequestPriority } from '@/types/roadmap'

export interface RequestTemplate {
    id: string
    name: string
    description: string
    icon: React.ReactNode
    type: RequestType
    category: RequestCategory
    priority: RequestPriority
    titlePlaceholder: string
    descriptionTemplate: string
}

export const REQUEST_TEMPLATES: RequestTemplate[] = [
    {
        id: 'feature',
        name: 'Feature Request',
        description: 'Suggest a new feature or enhancement',
        icon: <Zap className="h-5 w-5 text-neon-green" />,
        type: 'feature',
        category: 'general',
        priority: 'medium',
        titlePlaceholder: 'Add ability to...',
        descriptionTemplate: `<h2>Problem</h2>
<p>Describe the problem this feature would solve...</p>

<h2>Proposed Solution</h2>
<p>How would you like this to work?</p>

<h2>Alternatives Considered</h2>
<p>Any workarounds you've tried?</p>

<h2>Additional Context</h2>
<p>Any other details that might help...</p>`,
    },
    {
        id: 'bug',
        name: 'Bug Report',
        description: 'Report something that isn\'t working correctly',
        icon: <Bug className="h-5 w-5 text-red-400" />,
        type: 'bug',
        category: 'general',
        priority: 'high',
        titlePlaceholder: '[Bug] Issue with...',
        descriptionTemplate: `<h2>Current Behavior</h2>
<p>Describe what's happening...</p>

<h2>Expected Behavior</h2>
<p>What should happen instead?</p>

<h2>Steps to Reproduce</h2>
<ol>
<li>Go to...</li>
<li>Click on...</li>
<li>See the error</li>
</ol>

<h2>Environment</h2>
<ul>
<li>Browser: </li>
<li>Device: </li>
</ul>`,
    },
    {
        id: 'improvement',
        name: 'Improvement',
        description: 'Suggest an improvement to existing functionality',
        icon: <FileText className="h-5 w-5 text-blue-400" />,
        type: 'improvement',
        category: 'general',
        priority: 'medium',
        titlePlaceholder: 'Improve the...',
        descriptionTemplate: `<h2>Current State</h2>
<p>Describe how it works currently...</p>

<h2>Suggested Improvement</h2>
<p>How could it be better?</p>

<h2>Benefits</h2>
<p>Why would this be valuable?</p>`,
    },
    {
        id: 'question',
        name: 'Question',
        description: 'Ask about how something works or should work',
        icon: <HelpCircle className="h-5 w-5 text-amber-400" />,
        type: 'integration',
        category: 'general',
        priority: 'low',
        titlePlaceholder: 'Question about...',
        descriptionTemplate: `<h2>Question</h2>
<p>What would you like to know?</p>

<h2>Context</h2>
<p>Any background that might help answer this...</p>`,
    },
]

interface RequestTemplatesProps {
    onSelectTemplate: (template: RequestTemplate) => void
}

export function RequestTemplates({ onSelectTemplate }: RequestTemplatesProps) {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <FileText className="h-4 w-4" />
                    Use Template
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Choose a Template</DialogTitle>
                    <DialogDescription>
                        Start with a pre-filled template to help structure your request
                    </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-3 pt-4">
                    {REQUEST_TEMPLATES.map((template) => (
                        <button
                            key={template.id}
                            onClick={() => onSelectTemplate(template)}
                            className={cn(
                                "flex flex-col items-start gap-2 p-4 rounded-lg border text-left transition-colors",
                                "hover:bg-accent hover:border-primary/50",
                                "focus:outline-none focus:ring-2 focus:ring-primary/50"
                            )}
                        >
                            <div className="flex items-center gap-2">
                                {template.icon}
                                <span className="font-medium">{template.name}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {template.description}
                            </p>
                        </button>
                    ))}
                </div>
            </DialogContent>
        </Dialog>
    )
}
