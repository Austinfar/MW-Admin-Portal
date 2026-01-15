import { getBusinessMetrics } from '@/lib/actions/analytics';
import { BusinessDashboard } from '@/components/analytics/BusinessDashboard';
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Business Analytics | MW Fitness Coaching',
    description: 'Track business performance and revenue.',
};

export default async function BusinessPage() {
    const metrics = await getBusinessMetrics();

    return (
        <div className="flex-1 space-y-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight text-foreground">Business Performance</h2>
            </div>
            <div className="hidden md:block">
                <BusinessDashboard metrics={metrics} />
            </div>
            <div className="md:hidden">
                {/* Mobile placeholder or responsive view usually handled by grid but extra safety */}
                <BusinessDashboard metrics={metrics} />
            </div>
        </div>
    );
}
