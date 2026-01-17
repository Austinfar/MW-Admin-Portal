'use client'

import { Button } from '@/components/ui/button'
import { Download, Loader2 } from 'lucide-react'
import { CommissionReportItem } from '@/lib/actions/reports'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { format } from 'date-fns'
import { useState } from 'react'
import { toast } from 'sonner'

interface DownloadCommissionReportButtonProps {
    data: CommissionReportItem[]
    currentDate: Date
}

export function DownloadCommissionReportButton({ data, currentDate }: DownloadCommissionReportButtonProps) {
    const [isGenerating, setIsGenerating] = useState(false)

    const generatePDF = () => {
        setIsGenerating(true)
        try {
            const doc = new jsPDF()

            // Header
            doc.setFontSize(18)
            doc.text('Weekly Commission Report', 14, 22)

            doc.setFontSize(11)
            doc.text(`Week of: ${format(currentDate, 'MMMM d, yyyy')}`, 14, 30)

            // Calculate splits per Coach
            const coachSplits: Record<string, { count: number; avgPercentage: number }> = {}
            data.forEach(item => {
                const name = item.coach?.name || 'Unknown'
                if (!coachSplits[name]) {
                    coachSplits[name] = { count: 0, avgPercentage: 0 }
                }
                coachSplits[name].count += 1
                coachSplits[name].avgPercentage += Number(item.split_percentage)
            })

            // Summary Table
            doc.setFontSize(14)
            doc.text('Summary by Coach', 14, 45)

            const summaryBody = Object.entries(coachSplits).map(([name, stats]) => [
                name,
                stats.count.toString(),
                `${(stats.avgPercentage / stats.count).toFixed(1)}%`
            ])

            autoTable(doc, {
                startY: 50,
                head: [['Coach', 'Total Splits', 'Avg Percentage']],
                body: summaryBody,
                theme: 'striped',
                headStyles: { fillColor: [16, 185, 129] },
            })

            // Detailed Breakdown
            const finalY = (doc as any).lastAutoTable.finalY || 50
            doc.text('Detailed Splits', 14, finalY + 15)

            const detailBody = data.map(item => [
                format(new Date(item.created_at), 'MMM d, HH:mm'),
                item.coach?.name || 'Unknown',
                item.role_in_sale.replace('_', ' '),
                item.client?.name || 'Client',
                `${item.split_percentage}%`,
                item.notes || '-'
            ])

            autoTable(doc, {
                startY: finalY + 20,
                head: [['Date', 'Coach', 'Role', 'Client', 'Split %', 'Notes']],
                body: detailBody,
                theme: 'grid',
                styles: { fontSize: 8 },
                headStyles: { fillColor: [6, 78, 59] },
            })

            doc.save(`commission-report-${format(currentDate, 'yyyy-MM-dd')}.pdf`)
            toast.success('Report downloaded successfully')
        } catch (error) {
            console.error('PDF Generation Error:', error)
            toast.error('Failed to generate PDF')
        } finally {
            setIsGenerating(false)
        }
    }

    return (
        <Button onClick={generatePDF} disabled={isGenerating || data.length === 0}>
            {isGenerating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Download className="mr-2 h-4 w-4" />
            )}
            Download Report
        </Button>
    )
}
