import { differenceInDays } from 'date-fns'

export interface HealthScoreFactors {
    paymentScore: number      // 0-100, weight 35%
    onboardingScore: number   // 0-100, weight 25%
    contractScore: number     // 0-100, weight 20%
    agreementScore: number    // 0-100, weight 20%
}

export interface HealthScoreResult {
    score: number             // 0-100 overall score
    factors: HealthScoreFactors
    status: 'healthy' | 'warning' | 'critical'
    color: string
}

interface HealthScoreInput {
    // Payment data
    hasStripeCustomer: boolean
    lastPaymentDate: string | null
    lastPaymentStatus: string | null
    hasFailedPaymentRecent: boolean

    // Onboarding data
    onboardingTotal: number
    onboardingCompleted: number

    // Contract data
    contractEndDate: string | null
    status: string

    // Agreement data
    hasSignedAgreement: boolean
    hasPendingAgreement: boolean
}

export function calculateHealthScore(input: HealthScoreInput): HealthScoreResult {
    const factors: HealthScoreFactors = {
        paymentScore: calculatePaymentScore(input),
        onboardingScore: calculateOnboardingScore(input),
        contractScore: calculateContractScore(input),
        agreementScore: calculateAgreementScore(input),
    }

    // Weighted average
    const score = Math.round(
        factors.paymentScore * 0.35 +
        factors.onboardingScore * 0.25 +
        factors.contractScore * 0.20 +
        factors.agreementScore * 0.20
    )

    const status = score >= 80 ? 'healthy' : score >= 50 ? 'warning' : 'critical'
    const color = status === 'healthy' ? 'text-emerald-500' : status === 'warning' ? 'text-amber-500' : 'text-red-500'

    return { score, factors, status, color }
}

function calculatePaymentScore(input: HealthScoreInput): number {
    let score = 100

    // No Stripe customer: -30 points
    if (!input.hasStripeCustomer) {
        score -= 30
    }

    // Failed payment recently: -50 points
    if (input.hasFailedPaymentRecent) {
        score -= 50
    }

    // No recent payment (check last payment date)
    if (input.lastPaymentDate) {
        const daysSincePayment = differenceInDays(new Date(), new Date(input.lastPaymentDate))
        if (daysSincePayment > 45) {
            score -= 30
        } else if (daysSincePayment > 30) {
            score -= 15
        }
    } else if (input.hasStripeCustomer) {
        // Has Stripe but no payments at all
        score -= 20
    }

    return Math.max(0, score)
}

function calculateOnboardingScore(input: HealthScoreInput): number {
    // If no onboarding tasks, assume complete (100)
    if (input.onboardingTotal === 0) {
        return 100
    }

    // Simple percentage of completed tasks
    const completionRate = input.onboardingCompleted / input.onboardingTotal
    return Math.round(completionRate * 100)
}

function calculateContractScore(input: HealthScoreInput): number {
    // If client is lost or inactive, contract score is 0
    if (input.status === 'lost') {
        return 0
    }

    if (input.status === 'inactive') {
        return 30
    }

    // If no contract end date (open-ended), that's neutral
    if (!input.contractEndDate) {
        return 70 // Open-ended is okay but not ideal
    }

    const daysUntilEnd = differenceInDays(new Date(input.contractEndDate), new Date())

    if (daysUntilEnd < 0) {
        // Contract expired
        return 20
    } else if (daysUntilEnd <= 14) {
        // Critical - ending very soon
        return 30
    } else if (daysUntilEnd <= 30) {
        // Warning - ending soon
        return 50
    } else if (daysUntilEnd <= 60) {
        // Approaching end
        return 70
    }

    return 100
}

function calculateAgreementScore(input: HealthScoreInput): number {
    if (input.hasSignedAgreement) {
        return 100
    }

    if (input.hasPendingAgreement) {
        return 60 // Agreement sent but not signed
    }

    // No agreement at all
    return 40
}

// Get health status color for UI
export function getHealthStatusColor(score: number): string {
    if (score >= 80) return 'text-emerald-500'
    if (score >= 50) return 'text-amber-500'
    return 'text-red-500'
}

export function getHealthStatusBgColor(score: number): string {
    if (score >= 80) return 'bg-emerald-500'
    if (score >= 50) return 'bg-amber-500'
    return 'bg-red-500'
}

export function getHealthStatusLabel(score: number): string {
    if (score >= 80) return 'Healthy'
    if (score >= 50) return 'Needs Attention'
    return 'At Risk'
}
