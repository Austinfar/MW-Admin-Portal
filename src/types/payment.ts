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
}
