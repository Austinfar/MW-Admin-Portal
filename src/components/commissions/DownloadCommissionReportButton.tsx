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

            // Calculate Totals per Coach
            const coachTotals: Record<string, number> = {}
            data.forEach(item => {
                const name = item.coach?.name || 'Unknown'
                coachTotals[name] = (coachTotals[name] || 0) + Number(item.amount)
            })

            // Summary Table
            doc.setFontSize(14)
            doc.text('Payout Summary', 14, 45)

            const summaryBody = Object.entries(coachTotals).map(([name, total]) => [
                name,
                new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(total)
            ])

            autoTable(doc, {
                startY: 50,
                head: [['Coach', 'Total Payout']],
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
                item.role,
                item.payment?.client?.name || 'Client',
                new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(item.payment?.amount || 0),
                `${item.percentage * 100}%`,
                new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(item.amount)
            ])

            autoTable(doc, {
                startY: finalY + 20,
                head: [['Date', 'Coach', 'Role', 'Client', 'Pay Amount', 'Rate', 'Commission']],
                body: detailBody,
                theme: 'grid',
                styles: { fontSize: 8 },
                headStyles: { fillColor: [6, 78, 59] }, // Darker green for detail header
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
