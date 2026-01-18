import { addDays, subDays, startOfDay, endOfDay, format, isAfter, isBefore } from 'date-fns';

export interface PayrollPeriod {
    id: string; // start_date string
    start: Date;
    end: Date;
    payoutDate: Date;
    label: string;
    isCurrent: boolean;
}

// Anchor: Dec 16, 2024 (Monday) is start of a confirmed period
// Ending: Dec 29, 2024 (Sunday)
// Payout: Jan 3, 2025 (Friday)
const ANCHOR_START = new Date('2024-12-16T00:00:00');

export function getPayrollPeriods(count: number = 10): PayrollPeriod[] {
    const periods: PayrollPeriod[] = [];
    const today = new Date();

    // Generate periods back and forward?
    // Let's generate periods surrounding today. 
    // Find the "current" cycle start based on anchor.

    const diffTime = today.getTime() - ANCHOR_START.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const cyclesSinceAnchor = Math.floor(diffDays / 14);

    // Let's generate from -count to +2 cycles relative to current
    // Or just generate a list of "Recent & Upcoming"

    const currentParamStart = diffDays >= 0
        ? addDays(ANCHOR_START, cyclesSinceAnchor * 14)
        : subDays(ANCHOR_START, Math.abs(cyclesSinceAnchor) * 14);

    // Let's generate 5 past, 1 current, 2 future? 
    // User probably wants to select historical ranges too.
    // Let's just generate a decent range relative to today.

    const startCycle = -12; // 6 months back
    const endCycle = 4; // 2 months forward

    for (let i = startCycle; i <= endCycle; i++) {
        const periodStart = addDays(currentParamStart, i * 14);
        const periodEnd = endOfDay(addDays(periodStart, 13));
        const payoutDate = addDays(periodEnd, 5); // Friday after Sunday end

        const isCurrent = isAfter(today, periodStart) && isBefore(today, periodEnd);

        periods.push({
            id: format(periodStart, 'yyyy-MM-dd'),
            start: periodStart,
            end: periodEnd,
            payoutDate: payoutDate,
            label: `${format(periodStart, 'MMM d')} - ${format(periodEnd, 'MMM d, yyyy')}`,
            isCurrent
        });
    }

    // Sort descending (newest first)
    return periods.sort((a, b) => b.start.getTime() - a.start.getTime());
}

export function getCurrentPeriod(): PayrollPeriod {
    const periods = getPayrollPeriods();
    return periods.find(p => p.isCurrent) || periods[0];
}
