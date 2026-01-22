export interface Payment {
    id: string
    stripe_payment_id: string
    amount: number
    currency?: string
    status: string
    client_email?: string | null
    stripe_customer_id?: string | null
    client_id: string | null
    product_name?: string | null
    payment_date: string
    commission_calculated?: boolean
    created_at: string
    clients?: { name: string } | null
    // Refund fields
    refund_amount?: number | null
    refunded_at?: string | null
    // Fee fields
    stripe_fee?: number | null
    net_amount?: number | null
    // Dispute fields
    dispute_status?: string | null
    dispute_id?: string | null
}
