

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CommissionActiveView } from '@/components/commissions/CommissionActiveView';
import { CommissionHistoryView } from '@/components/commissions/CommissionHistoryView';

import { protectRoute } from '@/lib/protect-route';

export default async function CommissionDashboard() {
    await protectRoute('can_view_commissions');

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
                        Commission Dashboard
                    </h1>
                    <p className="text-muted-foreground mt-1">Track earnings, manage payroll, and review history.</p>
                </div>
            </div>

            <Tabs defaultValue="active" className="w-full">
                <TabsList className="bg-white/5 border border-white/10 p-1">
                    <TabsTrigger value="active">Active Pay Period</TabsTrigger>
                    <TabsTrigger value="history">Payroll History</TabsTrigger>
                </TabsList>

                <TabsContent value="active" className="mt-6">
                    <CommissionActiveView />
                </TabsContent>

                <TabsContent value="history" className="mt-6">
                    <CommissionHistoryView />
                </TabsContent>
            </Tabs>
        </div>
    );
}
