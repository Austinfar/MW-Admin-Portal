// Client risk indicator calculation logic
// Server-compatible - no 'use client' directive

export interface RiskIndicator {
    type: 'payment' | 'engagement' | 'contract'
    severity: 'warning' | 'critical'
    message: string
}

export interface RiskIndicatorInput {
    hasFailedPayment: boolean
    lastPaymentDaysAgo: number | null
    overdueOnboardingTasks: number
    contractEndDays: number | null
    hasRenewalAgreement: boolean
}

export function calculateRiskIndicators(input: RiskIndicatorInput): RiskIndicator[] {
    const indicators: RiskIndicator[] = []

    // Payment risks
    if (input.hasFailedPayment) {
        indicators.push({
            type: 'payment',
            severity: 'critical',
            message: 'Recent payment failed',
        })
    } else if (input.lastPaymentDaysAgo && input.lastPaymentDaysAgo > 45) {
        indicators.push({
            type: 'payment',
            severity: 'warning',
            message: `No payment in ${input.lastPaymentDaysAgo} days`,
        })
    }

    // Engagement risks
    if (input.overdueOnboardingTasks > 0) {
        indicators.push({
            type: 'engagement',
            severity: input.overdueOnboardingTasks > 3 ? 'critical' : 'warning',
            message: `${input.overdueOnboardingTasks} overdue onboarding task${input.overdueOnboardingTasks > 1 ? 's' : ''}`,
        })
    }

    // Contract risks
    if (input.contractEndDays !== null) {
        if (input.contractEndDays <= 14 && !input.hasRenewalAgreement) {
            indicators.push({
                type: 'contract',
                severity: 'critical',
                message: `Contract expires in ${input.contractEndDays} days`,
            })
        } else if (input.contractEndDays <= 30 && !input.hasRenewalAgreement) {
            indicators.push({
                type: 'contract',
                severity: 'warning',
                message: `Contract expires in ${input.contractEndDays} days`,
            })
        }
    }

    return indicators
}
