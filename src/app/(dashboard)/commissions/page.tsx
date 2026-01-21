import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { CommissionActiveView } from '@/components/commissions/CommissionActiveView';
import { CommissionHistoryView } from '@/components/commissions/CommissionHistoryView';
import { Settings, Upload, Link2, BarChart3 } from 'lucide-react';

import { protectRoute } from '@/lib/protect-route';
import { getCurrentUserProfile } from '@/lib/actions/profile';

export default async function CommissionDashboard() {
    await protectRoute('can_view_commissions');

    const profile = await getCurrentUserProfile();
    const isAdmin = profile?.role === 'super_admin' || profile?.role === 'admin';

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
                        Commission Dashboard
                    </h1>
                    <p className="text-muted-foreground mt-1">Track earnings, manage payroll, and review history.</p>
                </div>

                {isAdmin && (
                    <div className="flex gap-2">
                        <Link href="/commissions/analytics">
                            <Button variant="outline" className="bg-white/5 border-white/10 hover:bg-white/10">
                                <BarChart3 className="mr-2 h-4 w-4" />
                                Analytics
                            </Button>
                        </Link>
                        <Link href="/commissions/subscriptions">
                            <Button variant="outline" className="bg-white/5 border-white/10 hover:bg-white/10">
                                <Link2 className="mr-2 h-4 w-4" />
                                Subscriptions
                            </Button>
                        </Link>
                        <Link href="/commissions/import">
                            <Button variant="outline" className="bg-white/5 border-white/10 hover:bg-white/10">
                                <Upload className="mr-2 h-4 w-4" />
                                Import
                            </Button>
                        </Link>
                        <Link href="/commissions/settings">
                            <Button variant="outline" className="bg-white/5 border-white/10 hover:bg-white/10">
                                <Settings className="mr-2 h-4 w-4" />
                                Settings
                            </Button>
                        </Link>
                    </div>
                )}
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
