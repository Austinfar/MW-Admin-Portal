import { getWeeklyCommissions } from '@/lib/actions/reports'
import { WeeklyReport } from '@/components/commissions/WeeklyReport'
import { DownloadCommissionReportButton } from '@/components/commissions/DownloadCommissionReportButton'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default async function CommissionsPage() {
    // Default to current week
    // In a real app we'd parse searchParams for date range
    const currentDate = new Date()
    const reportData = await getWeeklyCommissions(currentDate)

    return (
        <div className="flex-1 space-y-6">
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-foreground">Commissions</h2>
                    <p className="text-muted-foreground">
                        Weekly payout reports and commission tracking.
                    </p>
                </div>
                <div className="flex items-center space-x-2">
                    <Link href="/commissions/settings">
                        <Button variant="outline">Settings</Button>
                    </Link>
                    <DownloadCommissionReportButton data={reportData} currentDate={currentDate} />
                </div>
            </div>

            <WeeklyReport data={reportData} currentDate={currentDate} />
        </div>
    )
}
