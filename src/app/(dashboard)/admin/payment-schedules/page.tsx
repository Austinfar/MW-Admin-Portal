import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { protectRoute } from '@/lib/protect-route';
import { getCurrentUserAccess } from '@/lib/auth-utils';
import { getAllPaymentSchedules } from '@/lib/actions/payment-schedules';
import { PaymentSchedulesTable } from '@/components/admin/payment-schedules/PaymentSchedulesTable';

export const metadata: Metadata = {
    title: 'Payment Schedules | MW Fitness Coaching',
    description: 'Manage all payment schedules across clients.',
};

export default async function PaymentSchedulesPage() {
    // Protect route - requires can_view_business permission
    await protectRoute('can_view_business');

    // Additional check: only admin/super_admin
    const userAccess = await getCurrentUserAccess();
    if (!userAccess || (userAccess.role !== 'admin' && userAccess.role !== 'super_admin')) {
        redirect('/roadmap');
    }

    const schedules = await getAllPaymentSchedules();

    return (
        <div className="flex-1 space-y-6 p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-foreground">
                        Payment Schedules
                    </h2>
                    <p className="text-muted-foreground mt-1">
                        Manage payment schedules and individual charges across all clients.
                    </p>
                </div>
            </div>

            <PaymentSchedulesTable data={schedules} />
        </div>
    );
}
