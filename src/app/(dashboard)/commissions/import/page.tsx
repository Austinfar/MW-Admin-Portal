import { CSVImporter } from '@/components/commissions/CSVImporter'
import { Separator } from '@/components/ui/separator'

export default function ImportPage() {
    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Import Commissions</h2>
                    <p className="text-muted-foreground">
                        Import historical commission data from CSV files.
                    </p>
                </div>
            </div>

            <Separator />

            <CSVImporter />
        </div>
    )
}
