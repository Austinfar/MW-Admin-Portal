'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { FileText, Download, X } from 'lucide-react'

interface ReportViewerProps {
    reportHtml: string | null
    clientName: string
    date: string
}

import ReactMarkdown from 'react-markdown'

export function ReportViewer({ reportHtml, clientName, date }: ReportViewerProps) {
    const [isOpen, setIsOpen] = useState(false)

    const handleDownload = () => {
        if (!reportHtml) return

        const printWindow = window.open('', '_blank')
        if (!printWindow) return

        const content = `
            <!DOCTYPE html>
            <html>
                <head>
                    <title>AI Analysis Report - ${clientName} - ${date}</title>
                    <style>
                        body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.5; padding: 40px; max-width: 800px; margin: 0 auto; color: #1a1a1a; }
                        h1 { font-size: 24px; margin-bottom: 20px; border-bottom: 1px solid #eaeaea; padding-bottom: 10px; }
                        h2 { font-size: 20px; margin-top: 30px; margin-bottom: 15px; color: #333; }
                        p { margin-bottom: 15px; }
                        ul { margin-bottom: 15px; padding-left: 20px; }
                        li { margin-bottom: 8px; }
                        @media print {
                            body { -webkit-print-color-adjust: exact; }
                        }
                    </style>
                </head>
                <body>
                    <h1>Call Analysis Report</h1>
                    <p><strong>Client:</strong> ${clientName}</p>
                    <p><strong>Date:</strong> ${date}</p>
                    <hr style="margin: 20px 0; border: 0; border-top: 1px solid #eaeaea;" />
                    <div style="white-space: pre-wrap;">${reportHtml}</div>
                    <script>
                        window.onload = function() {
                            window.print();
                        }
                    </script>
                </body>
            </html>
        `

        printWindow.document.write(content)
        printWindow.document.close()
    }

    if (!reportHtml) return null

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-400 hover:text-blue-300 transition-colors">
                    <FileText className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] w-full h-[95vh] flex flex-col p-0 gap-0 bg-[#0a0a0a] border-white/10 shadow-2xl duration-200 sm:rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-8 py-6 border-b border-white/5 bg-[#0a0a0a]">
                    <div className="flex flex-col gap-1">
                        <h2 className="text-2xl font-bold text-white tracking-tight">Call Analysis Report</h2>
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                            <span className="font-medium text-white">{clientName}</span>
                            <span>•</span>
                            <span>{date}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button
                            variant="outline"
                            onClick={handleDownload}
                            className="bg-transparent border-white/10 text-gray-300 hover:bg-white/5 hover:text-white transition-all"
                        >
                            <Download className="h-4 w-4 mr-2" />
                            Export PDF
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsOpen(false)}
                            className="text-gray-400 hover:text-white hover:bg-white/5 rounded-full"
                        >
                            <X className="h-5 w-5" />
                        </Button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto bg-[#0f0f0f]">
                    <div className="max-w-5xl mx-auto py-12 px-8">
                        <div className="prose prose-invert prose-lg max-w-none 
                            prose-headings:text-white prose-headings:font-bold prose-headings:tracking-tight
                            prose-p:text-gray-300 prose-p:leading-relaxed
                            prose-strong:text-white prose-strong:font-semibold
                            prose-ul:text-gray-300 prose-li:marker:text-green-500
                            prose-blockquote:border-l-green-500 prose-blockquote:bg-white/5 prose-blockquote:py-2 prose-blockquote:px-6 prose-blockquote:rounded-r-lg prose-blockquote:not-italic
                            prose-a:text-green-400 prose-a:no-underline hover:prose-a:text-green-300 hover:prose-a:underline">
                            <div
                                dangerouslySetInnerHTML={{
                                    __html: reportHtml
                                        ? reportHtml
                                            .replace(/\\n/g, '<br />')
                                            .replace(/\n/g, '<br />')
                                        : ''
                                }}
                            />
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
