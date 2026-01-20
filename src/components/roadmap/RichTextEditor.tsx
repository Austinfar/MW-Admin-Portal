'use client'

import { useEditor, EditorContent, Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Bold, Italic, List, ListOrdered, Code, Heading2, Quote, Undo, Redo } from 'lucide-react'
import { Toggle } from '@/components/ui/toggle'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

interface RichTextEditorProps {
    content: string
    onChange: (content: string) => void
    placeholder?: string
    disabled?: boolean
    minHeight?: string
    className?: string
}

export function RichTextEditor({
    content,
    onChange,
    placeholder = 'Write something...',
    disabled = false,
    minHeight = '150px',
    className,
}: RichTextEditorProps) {
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: {
                    levels: [2, 3],
                },
            }),
            Placeholder.configure({
                placeholder,
                emptyEditorClass: 'is-editor-empty',
            }),
        ],
        content,
        editable: !disabled,
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML())
        },
        editorProps: {
            attributes: {
                class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none px-3 py-2 min-h-[150px]',
            },
        },
        immediatelyRender: false, // Fixes SSR hydration issues
    })

    if (!editor) {
        return (
            <div className={cn(
                "border rounded-md overflow-hidden bg-background min-h-[200px] flex items-center justify-center",
                className
            )}>
                <span className="text-muted-foreground text-sm">Loading editor...</span>
            </div>
        )
    }

    return (
        <div className={cn(
            "border rounded-md overflow-hidden bg-background rich-text-editor",
            disabled && "opacity-50",
            className
        )}>
            {/* Toolbar */}
            <EditorToolbar editor={editor} disabled={disabled} />

            {/* Editor Content */}
            <EditorContent editor={editor} className="rich-text-content" />
        </div>
    )
}

function EditorToolbar({ editor, disabled }: { editor: Editor; disabled: boolean }) {
    return (
        <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b bg-muted/30">
            <Toggle
                size="sm"
                pressed={editor.isActive('bold')}
                onPressedChange={() => editor.chain().focus().toggleBold().run()}
                disabled={disabled}
                aria-label="Bold"
            >
                <Bold className="h-4 w-4" />
            </Toggle>
            <Toggle
                size="sm"
                pressed={editor.isActive('italic')}
                onPressedChange={() => editor.chain().focus().toggleItalic().run()}
                disabled={disabled}
                aria-label="Italic"
            >
                <Italic className="h-4 w-4" />
            </Toggle>
            <Toggle
                size="sm"
                pressed={editor.isActive('code')}
                onPressedChange={() => editor.chain().focus().toggleCode().run()}
                disabled={disabled}
                aria-label="Code"
            >
                <Code className="h-4 w-4" />
            </Toggle>

            <Separator orientation="vertical" className="mx-1 h-6" />

            <Toggle
                size="sm"
                pressed={editor.isActive('heading', { level: 2 })}
                onPressedChange={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                disabled={disabled}
                aria-label="Heading"
            >
                <Heading2 className="h-4 w-4" />
            </Toggle>
            <Toggle
                size="sm"
                pressed={editor.isActive('bulletList')}
                onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
                disabled={disabled}
                aria-label="Bullet List"
            >
                <List className="h-4 w-4" />
            </Toggle>
            <Toggle
                size="sm"
                pressed={editor.isActive('orderedList')}
                onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}
                disabled={disabled}
                aria-label="Ordered List"
            >
                <ListOrdered className="h-4 w-4" />
            </Toggle>
            <Toggle
                size="sm"
                pressed={editor.isActive('blockquote')}
                onPressedChange={() => editor.chain().focus().toggleBlockquote().run()}
                disabled={disabled}
                aria-label="Quote"
            >
                <Quote className="h-4 w-4" />
            </Toggle>

            <Separator orientation="vertical" className="mx-1 h-6" />

            <Toggle
                size="sm"
                pressed={false}
                onPressedChange={() => editor.chain().focus().undo().run()}
                disabled={disabled || !editor.can().undo()}
                aria-label="Undo"
            >
                <Undo className="h-4 w-4" />
            </Toggle>
            <Toggle
                size="sm"
                pressed={false}
                onPressedChange={() => editor.chain().focus().redo().run()}
                disabled={disabled || !editor.can().redo()}
                aria-label="Redo"
            >
                <Redo className="h-4 w-4" />
            </Toggle>
        </div>
    )
}

// Read-only viewer for displaying rich text content
export function RichTextViewer({ content, className }: { content: string; className?: string }) {
    const editor = useEditor({
        extensions: [StarterKit],
        content,
        editable: false,
        editorProps: {
            attributes: {
                class: 'prose prose-sm dark:prose-invert max-w-none',
            },
        },
        immediatelyRender: false,
    })

    if (!editor) {
        return <div className={className} dangerouslySetInnerHTML={{ __html: content }} />
    }

    return (
        <div className={className}>
            <EditorContent editor={editor} />
        </div>
    )
}
