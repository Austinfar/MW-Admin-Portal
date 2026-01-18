'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { FileText, Download, X } from 'lucide-react'
import { toast } from 'sonner'

interface ReportViewerProps {
    reportHtml: string | null
    reportUrl?: string | null
    clientName: string
    date: string
}

export function ReportViewer({ reportHtml, reportUrl, clientName, date }: ReportViewerProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [iframeContent, setIframeContent] = useState('')
    const [isLoading, setIsLoading] = useState(false)

    useEffect(() => {
        const loadContent = async () => {
            // Priority 1: Direct HTML Content (Database)
            // We always prefer this for the preview iframe if available.
            if (reportHtml) {
                processHtml(reportHtml)
                return
            }

            // Priority 2: Stored URL (could be HTML or PDF)
            if (reportUrl) {
                // If it's a PDF, we can't show it in the iframe as HTML.
                // Since we don't have reportHtml, we show a placeholder.
                if (reportUrl.toLowerCase().endsWith('.pdf')) {
                    setIframeContent('<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;font-family:sans-serif;"><h1>PDF Report Available</h1><p>The detailed HTML report is not stored, but you can view the PDF.</p></div>')
                    return
                }

                // If it's not a PDF, assume it's an HTML file stored in bucket
                setIsLoading(true)
                try {
                    const response = await fetch(reportUrl)
                    const text = await response.text()
                    processHtml(text)
                } catch (error) {
                    console.error('Failed to load report:', error)
                    setIframeContent('<h1>Error loading report</h1><p>Please try again later.</p>')
                } finally {
                    setIsLoading(false)
                }
            } else {
                setIframeContent('')
            }
        }

        loadContent()
    }, [reportHtml, reportUrl, clientName])

    const processHtml = (rawHtml: string) => {
        let decoded = rawHtml

        // Basic decoding
        const unescapeMap: { [key: string]: string } = {
            '&lt;': '<',
            '&gt;': '>',
            '&quot;': '"',
            '&#039;': "'",
            '&amp;': '&',
            '&nbsp;': ' '
        }

        decoded = decoded.replace(/&lt;|&gt;|&quot;|&#039;|&amp;|&nbsp;/g, function (s) {
            return unescapeMap[s] || s
        })

        decoded = decoded.replace(/\\"/g, '"')
        decoded = decoded.replace(/```html/g, '').replace(/```/g, '')

        // Advanced HTML Merging
        // 1. Parse the uploaded HTML to separate Head (styles) and Body (content)
        const parser = new DOMParser()
        const doc = parser.parseFromString(decoded, 'text/html')

        // 2. Extract existing styles/links from the uploaded head
        const uploadedHeadContent = doc.head.innerHTML
        const uploadedBodyContent = doc.body.innerHTML || decoded

        // 3. Construct the final merged document
        // We inject Tailwind CDN because the "Cards" layout typically relies on utility classes
        // We also inject our Inter font as a baseline
        const htmlDoc = `
            <!DOCTYPE html>
            <html>
                <head>
                    <meta charset="utf-8">
                    <title>Report - ${clientName}</title>
                    <link rel="preconnect" href="https://fonts.googleapis.com">
                    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
                    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
                    
                    <!-- Inject Tailwind for rich features -->
                    <script src="https://cdn.tailwindcss.com"></script>
                    <script>
                        tailwind.config = {
                            theme: {
                                extend: {
                                    fontFamily: {
                                        sans: ['Inter', 'sans-serif'],
                                    },
                                    colors: {
                                        blue: { 50: '#eff6ff', 100: '#dbeafe', 500: '#3b82f6', 600: '#2563eb' },
                                        green: { 50: '#f0fdf4', 100: '#dcfce7', 500: '#22c55e' },
                                        gray: { 50: '#f9fafb', 100: '#f3f4f6', 200: '#e5e7eb', 800: '#1f2937', 900: '#111827' }
                                    }
                                }
                            }
                        }
                    </script>

                    <!-- Add our default styles for baseline formatting -->
                    <style>
                        body { 
                            font-family: 'Inter', system-ui, -apple-system, sans-serif;
                            background-color: #ffffff;
                            color: #111827;
                             /* Reset padding if Tailwind container is used inside, otherwise default */
                             padding: 0; 
                             margin: 0;
                         }
                        /* Conditional Zoom: Mobile only (screen < 768px) */
                        @media (max-width: 768px) {
                             body {
                                 zoom: 0.4; /* Scale content down on mobile */
                             }
                        }
                         /* Add a wrapper class for centering only if not already handled */
                         .viewer-container {
                             max-width: 100%;
                             margin: 0 auto;
                             padding: 2rem;
                             padding-top: 5rem; /* Ensure title clears floating buttons */
                         }
                         /* Print optimizations */
                         @media print {
                             body { padding: 0; max-width: none; }
                             @page { margin: 2cm; }
                         }
                     </style>
 
                     <!-- Inject Uploaded Head Content (Custom Styles) -->
                     ${uploadedHeadContent}
                 </head>
                 <body>
                     <div class="viewer-container">
                         ${uploadedBodyContent}
                     </div>
                 </body>
             </html>
         `
        setIframeContent(htmlDoc)
    }

    const [isExporting, setIsExporting] = useState(false)

    const handleExportPDF = async () => {
        if (isExporting) return

        // Open window immediately to bypass popup blockers
        const loadWindow = window.open('', '_blank')

        // Check if we have a stored PDF URL first
        if (reportUrl && reportUrl.toLowerCase().endsWith('.pdf')) {
            if (loadWindow) {
                loadWindow.document.write('<html><head><title>Downloading...</title><style>body{font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;background:#111;color:#fff;margin:0;}</style></head><body><div style="text-align:center"><h2>Downloading Stored PDF...</h2><p>Please wait...</p></div></body></html>')
            }

            try {
                // Fetch blob to force download
                const response = await fetch(reportUrl)
                const blob = await response.blob()
                const url = window.URL.createObjectURL(blob)

                const link = document.createElement('a')
                link.href = url
                const filename = `Analysis_Report_${clientName.replace(/\s+/g, '_')}_${date.replace(/,/g, '')}.pdf`
                link.setAttribute('download', filename)
                document.body.appendChild(link)
                link.click()
                document.body.removeChild(link)
                window.URL.revokeObjectURL(url)

                if (loadWindow) loadWindow.close()
                toast.success('Stored PDF downloaded successfully')
            } catch (error) {
                console.error('Failed to download stored PDF:', error)
                if (loadWindow) loadWindow.location.href = reportUrl
                toast.success('Opening stored PDF...')
            }
            return
        }

        if (loadWindow) {
            loadWindow.document.write('<html><head><title>Generating PDF...</title><style>body{font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;background:#111;color:#fff;margin:0;}</style></head><body><div style="text-align:center"><h2>Generating your PDF...</h2><p>Please wait (Server Generation)...</p></div></body></html>')
        }

        setIsExporting(true)

        try {
            const { generatePdf } = await import('@/lib/actions/pdf')

            const result = await generatePdf(iframeContent)

            if (result.error) {
                if (loadWindow) loadWindow.close()
                toast.error(`Export failed: ${result.error}`)
                return
            }

            if (result.url) {
                if (loadWindow) {
                    loadWindow.location.href = result.url
                } else {
                    const link = document.createElement('a')
                    link.href = result.url
                    const filename = `Analysis_Report_${clientName.replace(/\s+/g, '_')}_${date.replace(/,/g, '')}.pdf`
                    link.setAttribute('download', filename)
                    link.setAttribute('target', '_blank')
                    document.body.appendChild(link)
                    link.click()
                    document.body.removeChild(link)
                }
                toast.success('PDF generated successfully')
            }
        } catch (error) {
            console.error('Export error:', error)
            if (loadWindow) loadWindow.close()
            toast.error('Failed to export PDF')
        } finally {
            setIsExporting(false)
        }
    }

    if (!reportHtml && !reportUrl) return null

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-400 hover:text-blue-300 transition-colors">
                    <FileText className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent showCloseButton={false} className="w-screen h-screen max-w-none rounded-none border-0 left-1/2 sm:border sm:w-[70vw] sm:h-[90vh] sm:max-w-[70vw] sm:left-[calc(50%+9rem)] flex flex-col p-0 gap-0 bg-[#0a0a0a] border-white/10 shadow-2xl duration-200 sm:rounded-xl overflow-hidden">
                {/* Screen Reader Title for Accessibility */}
                <DialogTitle className="sr-only">
                    Call Analysis Report - {clientName}
                </DialogTitle>

                {/* Floating Toolbar */}
                <div className="absolute top-4 right-6 z-50 flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExportPDF}
                        disabled={isExporting}
                        className="bg-black/50 backdrop-blur-md border-white/10 text-white hover:bg-zinc-800 hover:text-white transition-all shadow-sm"
                    >
                        {isExporting ? (
                            <span className="loading loading-spinner loading-xs mr-2"></span>
                        ) : (
                            <FileText className="h-4 w-4 mr-2" />
                        )}
                        {isExporting ? 'Exporting...' : 'Export PDF'}
                    </Button>

                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setIsOpen(false)}
                        className="bg-black/50 backdrop-blur-md border-white/10 text-white hover:bg-zinc-800 hover:text-white transition-all shadow-sm rounded-full h-9 w-9"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                {/* Content Area - Iframe */}
                <div className="flex-1 bg-[#1a1a1a] relative w-full h-full overflow-hidden">
                    {isLoading ? (
                        <div className="flex items-center justify-center w-full h-full text-white">
                            <span className="loading loading-spinner loading-lg"></span>
                            <span className="ml-2">Loading report...</span>
                        </div>
                    ) : (
                        <iframe
                            id="report-iframe"
                            srcDoc={iframeContent}
                            title="Report Preview"
                            className="w-full h-full border-none bg-white block"
                            sandbox="allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox"
                        />
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
