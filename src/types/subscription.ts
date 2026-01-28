/**
 * Subscription Management Types
 */

export type SubscriptionStatus =
    | 'active'
    | 'paused'
    | 'canceled'
    | 'past_due'
    | 'trialing'
    | 'incomplete'
    | 'incomplete_expired'
    | 'unpaid';

export type BillingInterval = 'day' | 'week' | 'month' | 'year';

export interface ClientSubscription {
    id: string;
    stripe_subscription_id: string;
    stripe_customer_id: string | null;
    status: SubscriptionStatus;
    plan_name: string | null;
    amount: number;
    currency: string;
    interval: BillingInterval;
    interval_count: number;
    current_period_end: string | null;
    next_billing_date: string | null;
    cancel_at_period_end: boolean;
    paused_at: string | null;
    resume_at: string | null;
    pending_cancellation_request_id: string | null;
    client_id: string | null;
    created_at: string;
    updated_at: string;
}

export type ApprovalRequestType = 'subscription_cancel' | 'refund' | 'other';
export type ApprovalRequestStatus = 'pending' | 'approved' | 'rejected';

export interface ApprovalRequest {
    id: string;
    request_type: ApprovalRequestType;
    status: ApprovalRequestStatus;
    client_id: string | null;
    stripe_subscription_id: string | null;
    requested_by: string;
    requested_at: string;
    reason: string;
    additional_notes: string | null;
    resolved_by: string | null;
    resolved_at: string | null;
    resolution_notes: string | null;
    metadata: Record<string, unknown>;
    created_at: string;
    updated_at: string;
    // Joined data
    requester?: { id: string; name: string; email: string } | null;
    resolver?: { id: string; name: string; email: string } | null;
    client?: { id: string; name: string; email: string } | null;
}

export type FreezeType = 'pause_at_period_end' | 'immediate_freeze';
export type FreezeStatus = 'pending' | 'active' | 'resumed' | 'cancelled';
export type FreezeDuration = '1_week' | '2_weeks' | '1_month';

export interface SubscriptionFreeze {
    id: string;
    client_id: string;
    stripe_subscription_id: string;
    freeze_type: FreezeType;
    freeze_duration_days: number | null;
    status: FreezeStatus;
    started_at: string | null;
    scheduled_resume_at: string | null;
    actual_resumed_at: string | null;
    original_period_end: string | null;
    extended_period_end: string | null;
    created_by: string;
    created_at: string;
    resumed_by: string | null;
    metadata: Record<string, unknown>;
}

export type FreezeOption =
    | { type: 'pause_at_period_end' }
    | { type: 'immediate_freeze'; duration: FreezeDuration };

// Helper to convert FreezeDuration to days
export const FREEZE_DURATION_DAYS: Record<FreezeDuration, number> = {
    '1_week': 7,
    '2_weeks': 14,
    '1_month': 30,
};

// Payment Schedule types
export interface ScheduledCharge {
    id: string;
    schedule_id: string;
    amount: number;
    due_date: string;
    status: 'pending' | 'paid' | 'failed' | 'cancelled';
    stripe_payment_intent_id: string | null;
    stripe_invoice_id: string | null;
    created_at: string;
}

export interface PaymentScheduleWithCharges {
    id: string;
    client_id: string | null;
    plan_name: string | null;
    amount: number;
    total_amount: number;
    remaining_amount: number;
    currency: string;
    status: string;
    payment_type: string;
    start_date: string | null;
    program_term: string | null;
    scheduled_charges: ScheduledCharge[];
    created_at: string;
    // Stripe fields for linking to transactions
    stripe_session_id: string | null;
    stripe_price_id: string | null;
    stripe_payment_intent_id: string | null;
}

export interface PaymentScheduleSummary {
    schedules: PaymentScheduleWithCharges[];
    totalValue: number;
    totalPaid: number;
    totalRemaining: number;
}

// Extended type for admin payment schedule management
export interface PaymentScheduleWithClientInfo extends PaymentScheduleWithCharges {
    client: {
        id: string;
        name: string;
        email: string;
        status: 'active' | 'inactive' | 'lost' | 'onboarding';
    } | null;
    pendingChargesCount: number;
    hasClientWarning: boolean;
}
