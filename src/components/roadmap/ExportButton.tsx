'use client'

import { useState } from 'react'
import { Download, FileText, FileSpreadsheet, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import { getFeatureRequests } from '@/lib/actions/feature-requests'
import type { FeatureRequest, RequestFilters } from '@/types/roadmap'

interface ExportButtonProps {
    filters?: RequestFilters
}

export function ExportButton({ filters }: ExportButtonProps) {
    const [isExporting, setIsExporting] = useState(false)

    const handleExportCSV = async () => {
        setIsExporting(true)
        try {
            // Fetch all requests with current filters
            const result = await getFeatureRequests(
                filters || {},
                { field: 'created_at', direction: 'desc' },
                { page: 1, limit: 1000 }
            )

            const requests = result.data

            // Build CSV
            const headers = [
                'Title',
                'Description',
                'Status',
                'Category',
                'Type',
                'Priority',
                'Votes',
                'Comments',
                'Submitter',
                'Created At',
                'Target Quarter',
            ]

            const rows = requests.map((r: FeatureRequest) => [
                escapeCSV(r.title),
                escapeCSV(stripHtml(r.description || '')),
                r.status,
                r.category,
                r.type,
                r.priority,
                r.vote_count,
                r.comment_count || 0,
                r.submitter?.name || 'Unknown',
                new Date(r.created_at).toLocaleDateString(),
                r.target_quarter || '',
            ])

            const csv = [
                headers.join(','),
                ...rows.map(row => row.join(','))
            ].join('\n')

            // Download
            downloadFile(csv, 'feature-requests.csv', 'text/csv')
            toast.success(`Exported ${requests.length} requests`)
        } catch (error) {
            console.error('Export error:', error)
            toast.error('Failed to export')
        } finally {
            setIsExporting(false)
        }
    }

    const handleExportJSON = async () => {
        setIsExporting(true)
        try {
            const result = await getFeatureRequests(
                filters || {},
                { field: 'created_at', direction: 'desc' },
                { page: 1, limit: 1000 }
            )

            const json = JSON.stringify(result.data, null, 2)
            downloadFile(json, 'feature-requests.json', 'application/json')
            toast.success(`Exported ${result.data.length} requests`)
        } catch (error) {
            console.error('Export error:', error)
            toast.error('Failed to export')
        } finally {
            setIsExporting(false)
        }
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={isExporting}>
                    {isExporting ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                        <Download className="h-4 w-4 mr-2" />
                    )}
                    Export
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportCSV}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportJSON}>
                    <FileText className="h-4 w-4 mr-2" />
                    Export as JSON
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

// Helper functions
function escapeCSV(str: string): string {
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
    }
    return str
}

function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function downloadFile(content: string, filename: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
}
