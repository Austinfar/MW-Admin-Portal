import { getBusinessMetrics } from '@/lib/actions/analytics';
import { BusinessDashboard } from '@/components/analytics/BusinessDashboard';
import { BusinessSettingsCard } from '@/components/business/BusinessSettingsCard';
import { Metadata } from 'next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { protectRoute } from '@/lib/protect-route';

export const metadata: Metadata = {
    title: 'Business Analytics | MW Fitness Coaching',
    description: 'Track business performance and revenue.',
};

export default async function BusinessPage() {
    await protectRoute('can_view_business');

    const metrics = await getBusinessMetrics();

    return (
        <div className="flex-1 space-y-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight text-foreground">Business</h2>
            </div>

            <Tabs defaultValue="analytics" className="w-full">
                <TabsList className="bg-card/50 border border-white/5">
                    <TabsTrigger value="analytics">Analytics</TabsTrigger>
                    <TabsTrigger value="settings">Settings</TabsTrigger>
                </TabsList>

                <TabsContent value="analytics" className="mt-6">
                    <BusinessDashboard metrics={metrics} />
                </TabsContent>

                <TabsContent value="settings" className="mt-6">
                    <div className="max-w-2xl">
                        <BusinessSettingsCard />
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
