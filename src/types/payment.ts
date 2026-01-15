export interface Payment {
    id: string
    stripe_payment_id: string
    amount: number
    currency: string
    status: string
    created: string
    client_email: string | null
    stripe_customer_id: string | null
    client_id: string | null
    description: string | null
    created_at: string
}
