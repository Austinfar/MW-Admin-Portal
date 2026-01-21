'use client';

import { useState, useEffect } from 'react';
import { PayrollRunList } from './PayrollRunList';
import { PayrollRunDetails } from './PayrollRunDetails';

export function CommissionHistoryView() {
    const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
    const [canApprove, setCanApprove] = useState(false);

    useEffect(() => {
        async function checkPermissions() {
            try {
                const { getCurrentUserProfile } = await import('@/lib/actions/profile');
                const profile = await getCurrentUserProfile();
                if (profile) {
                    // Super admins can always approve, others need explicit permission
                    const hasPermission =
                        profile.role === 'super_admin' ||
                        profile.permissions?.can_approve_payroll === true;
                    setCanApprove(hasPermission);
                }
            } catch (error) {
                console.error('Failed to check permissions:', error);
            }
        }
        checkPermissions();
    }, []);

    if (selectedRunId) {
        return (
            <PayrollRunDetails
                runId={selectedRunId}
                onBack={() => setSelectedRunId(null)}
                canApprove={canApprove}
            />
        );
    }

    return (
        <PayrollRunList
            onSelectRun={setSelectedRunId}
            selectedRunId={selectedRunId || undefined}
        />
    );
}
