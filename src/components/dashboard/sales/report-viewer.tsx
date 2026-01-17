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
                    ${reportHtml}
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
                <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-400 hover:text-blue-300">
                    <FileText className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0 gap-0 bg-[#1A1A1A] border-gray-800">
                <div className="flex items-center justify-between p-4 border-b border-gray-800">
                    <h2 className="text-lg font-semibold text-white">Call Analysis Report</h2>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleDownload}
                            className="bg-transparent border-gray-700 text-gray-300 hover:bg-gray-800"
                        >
                            <Download className="h-4 w-4 mr-2" />
                            Export PDF
                        </Button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-6 bg-white text-black rounded-b-lg">
                    {/* Render HTML safely here is okay because it comes from our trusted internal n8n workflow */}
                    <div
                        className="prose max-w-none dark:prose-invert"
                        dangerouslySetInnerHTML={{
                            __html: reportHtml
                                ? reportHtml
                                    .replace(/\\n/g, '<br />')
                                    .replace(/\n/g, '<br />')
                                : ''
                        }}
                    />
                </div>
            </DialogContent>
        </Dialog>
    )
}
