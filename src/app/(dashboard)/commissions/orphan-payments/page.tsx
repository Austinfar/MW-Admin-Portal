import { redirect } from 'next/navigation';
import { getCurrentUserProfile } from '@/lib/actions/profile';
import { OrphanPaymentsView } from '@/components/commissions/OrphanPaymentsView';

export const metadata = {
    title: 'Orphan Payments | MW Coaching',
    description: 'Review and match unmatched payments to clients',
};

export default async function OrphanPaymentsPage() {
    const profile = await getCurrentUserProfile();

    // Only admins can access this page
    if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
        redirect('/commissions');
    }

    return (
        <div className="container mx-auto py-6 px-4 max-w-6xl">
            <div className="mb-6">
                <h1 className="text-2xl font-bold">Orphan Payments</h1>
                <p className="text-muted-foreground">
                    Review and match payments that couldn&apos;t be automatically linked to a client.
                </p>
            </div>

            <OrphanPaymentsView />
        </div>
    );
}
