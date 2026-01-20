'use server'

import { stripe } from '@/lib/stripe'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function getStripeProducts() {
    try {
        const prices = await stripe.prices.list({
            active: true,
            limit: 100,
            expand: ['data.product'],
        })

        // Group by product or return flat with product info
        const products = prices.data.map(price => ({
            id: price.id,
            product_id: (price.product as Stripe.Product).id,
            product_name: (price.product as Stripe.Product).name,
            unit_amount: price.unit_amount,
            currency: price.currency,
            type: price.type, // 'one_time' or 'recurring'
            recurring: price.recurring,
        }))

        // Check if using test key (starts with sk_test) or derive from price data
        const isTestMode = prices.data.length > 0 ? !prices.data[0].livemode : process.env.STRIPE_SECRET_KEY?.startsWith('sk_test') || false

        // OPTIONAL: Filter products here if you only want to show specific ones
        const ALLOWED_PRODUCTS = [
            "1:1 Competition Prep Coaching",
            "1:1 Lifestyle Fitness Coaching",
            "1:1 Nutrition Coaching"
        ]

        const filteredProducts = ALLOWED_PRODUCTS.length > 0
            ? products.filter(p => ALLOWED_PRODUCTS.includes(p.product_name))
            : products

        console.log('All Stripe Products:', products.map(p => p.product_name))
        console.log('Allowed Filter:', ALLOWED_PRODUCTS)
        console.log('Resulting Products:', filteredProducts.map(p => p.product_name))

        return { products: filteredProducts, isTestMode }
    } catch (error) {
        console.error('Error fetching stripe products:', error)
        return { products: [], isTestMode: false }
    }
}

export async function createCheckoutSession(
    priceId: string,
    isRecurring: boolean,
    metadata: { scheduleId: string }
) {
    try {
        const session = await stripe.checkout.sessions.create({
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            mode: isRecurring ? 'subscription' : 'payment',
            success_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/payment/cancel`,
            metadata: {
                scheduleId: metadata.scheduleId
            }
        })

        if (!session.url) throw new Error('No session URL returned')

        return { url: session.url }
    } catch (error: any) {
        console.error('Error creating checkout session:', error)
        return { error: error?.message || 'Failed to create session' }
    }
}

interface SplitPaymentPayload {
    planName: string
    downPayment: number // in cents
    schedule: {
        amount: number // in cents
        dueDate: string
    }[]
    productId?: string // Optional link to Stripe Price/Product
    startDate?: string
    coachId?: string
    salesCloserId?: string
    clientId?: string
    leadId?: string
    clientTypeId?: string
    commissionSplits?: any[]
    programTerm?: '6' | '12'
}

// Helper to ensure Stripe Customer exists for a generic client
async function ensureStripeCustomer(supabase: any, clientId: string) {
    // 1. Fetch Client
    const { data: client, error } = await supabase
        .from('clients')
        .select('id, email, name, stripe_customer_id')
        .eq('id', clientId)
        .single()

    if (error || !client) {
        throw new Error("Client not found")
    }

    // 2. Return existing ID if present
    if (client.stripe_customer_id) {
        return client.stripe_customer_id
    }

    // 3. Create new Stripe Customer
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-12-15.clover' as any })
    const customer = await stripe.customers.create({
        email: client.email,
        name: client.name,
        metadata: {
            supabase_client_id: client.id
        }
    })

    // 4. Save back to Supabase
    await supabase.from('clients').update({ stripe_customer_id: customer.id }).eq('id', clientId)

    return customer.id
}

// ... existing helper methods ...

// 0. Fetch Coaches for Selector
export async function getCoaches() {
    // USE ADMIN CLIENT to bypass RLS and ensure we see all coaches
    const supabase = createAdminClient()

    // Fetch users with job_title 'coach' or 'head_coach'
    // Note: 'role' is for access level (super_admin/admin/user), 'job_title' is for job function
    const { data: coaches, error } = await supabase
        .from('users')
        .select('id, name, avatar_url')
        .in('job_title', ['coach', 'head_coach', 'admin_staff'])
        .eq('is_active', true)
        .order('name')

    if (error) {
        console.error('Error fetching coaches:', error instanceof Error ? error.message : error)
        return []
    }
    return coaches || []
}

// 0.1 Fetch Sales Closers for Selector (all team members)
export async function getSalesClosers() {
    const supabase = createAdminClient()

    // Fetch ALL active users - anyone can be a closer or referrer
    const { data: closers, error } = await supabase
        .from('users')
        .select('id, name, avatar_url')
        .eq('is_active', true)
        .order('name')

    if (error) {
        console.error('Error fetching sales closers:', error instanceof Error ? error.message : error)
        return []
    }
    return closers || []
}

// 0.2 Fetch Clients for Selector
export async function getClients() {
    const supabase = createAdminClient()

    const { data: clients, error } = await supabase
        .from('clients')
        .select('id, name, email, stripe_customer_id, assigned_coach_id, start_date')
        .order('name')

    if (error) {
        console.error('Error fetching clients:', error.message)
        return []
    }
    return clients || []
}

// 0.3 Fetch Leads for Payment Links Selector
export async function getLeadsForPaymentLinks() {
    const supabase = createAdminClient()

    const { data: leads, error } = await supabase
        .from('leads')
        .select('id, first_name, last_name, email, phone')
        .in('status', ['New', 'Contacted', 'Qualified']) // Only show active leads
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching leads:', error.message)
        return []
    }
    return leads || []
}



// 0.5 Update Schedule Details (Called before payment)
export async function updateScheduleDetails(id: string, details: { startDate?: string; coachId?: string }) {
    const supabase = await createClient()
    const { startDate, coachId } = details

    const updateData: any = {}
    if (startDate) updateData.start_date = startDate
    if (coachId) updateData.assigned_coach_id = coachId === 'tbd' ? null : coachId

    const { error } = await supabase
        .from('payment_schedules')
        .update(updateData)
        .eq('id', id)

    if (error) {
        console.error('Error updating schedule details:', error)
        return { error: 'Failed to update details' }
    }
    return { success: true }
}

// 1. Fetch Schedule Helper
export async function getPaymentSchedule(id: string) {
    const supabase = createAdminClient()
    const { data, error } = await supabase
        .from('payment_schedules')
        .select('*, scheduled_charges(*), coach:users!assigned_coach_id(name, avatar_url)') // Join users table to get coach name and avatar
        .eq('id', id)
        .order('due_date', { foreignTable: 'scheduled_charges', ascending: true })
        .single()

    if (error) return { error: 'Schedule not found' }
    return { data }
}

// 2. Create Embedded Checkout Session (Called by Client on Page Load or after Update)
export async function createCheckoutSessionForSchedule(scheduleId: string) {
    const supabase = createAdminClient()

    // Fetch Schedule with Client Relation
    const { data: schedule } = await supabase
        .from('payment_schedules')
        .select('*, client:clients(stripe_customer_id, email), lead:leads(email)')
        .eq('id', scheduleId)
        .single()

    if (!schedule) return { error: 'Schedule not found' }

    try {
        // Fallback for older records where 'amount' (column) might be null but 'total_amount' is set
        const effectiveAmount = schedule.amount ?? schedule.total_amount ?? schedule.remaining_amount ?? 0
        const isSetupMode = effectiveAmount === 0
        const isSubscription = schedule.payment_type === 'recurring'

        const sessionConfig: Stripe.Checkout.SessionCreateParams = {
            ui_mode: 'embedded',
            mode: isSetupMode ? 'setup' : (isSubscription ? 'subscription' : 'payment'),
            payment_method_types: ['card'],
            return_url: `${process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')}/pay/success?session_id={CHECKOUT_SESSION_ID}`,
            submit_type: isSubscription ? undefined : 'pay',
            billing_address_collection: 'auto',
            metadata: {
                scheduleId: schedule.id,
                planName: schedule.plan_name,
                isSplitPayment: (!isSubscription && !schedule.stripe_price_id) ? 'true' : 'false',
                paymentType: schedule.payment_type || 'one_time',
                assignedCoachId: schedule.assigned_coach_id || 'TBD',
                startDate: schedule.start_date || 'Not Set'
            },
        }

        // Logic to determine Customer vs Customer Email
        if (schedule.client?.stripe_customer_id) {
            sessionConfig.customer = schedule.client.stripe_customer_id
        } else {
            // Pre-fill email from Client or Lead record
            const userEmail = schedule.client?.email || schedule.lead?.email
            if (userEmail) {
                sessionConfig.customer_email = userEmail
            }
        }

        if (!isSetupMode) {
            // Subscription Mode
            if (isSubscription && schedule.stripe_price_id) {
                // Must be a Price ID for subscriptions
                sessionConfig.line_items = [
                    {
                        price: schedule.stripe_price_id,
                        quantity: 1,
                    },
                ]

                // BILLING ANCHOR LOGIC
                // Use User Selection (start_date) to drive billing cycle if present
                if (schedule.start_date) {
                    const startDate = new Date(schedule.start_date)
                    const now = new Date()

                    const nextBillDate = new Date(startDate)
                    nextBillDate.setMonth(nextBillDate.getMonth() + 1)

                    // Check if the "Next Bill Date" (Start + 1 Month) is at least 48 hours in the future
                    // Stripe requires trial_end to be at least 48h in future.
                    // If it is, we use the "Trial + One-Time Fee" pattern to charge NOW and start recurring LATER.
                    const isFutureStart = nextBillDate.getTime() > (now.getTime() + 48 * 60 * 60 * 1000)

                    if (isFutureStart) {
                        // PATTERN: Charge "Initial Payment" now (One-Time) + Start Subscription on Future Date (Trial)
                        sessionConfig.subscription_data = {
                            trial_end: Math.floor(nextBillDate.getTime() / 1000),
                            metadata: {
                                initialPayment: 'true'
                            }
                        }

                        // Add the One-Time "Initial Fee" Item
                        // We use price_data to create a one-time charge for the same amount
                        const oneTimeItem: Stripe.Checkout.SessionCreateParams.LineItem = {
                            price_data: {
                                currency: schedule.currency || 'usd',
                                product_data: {
                                    name: (schedule.plan_name || 'Subscription') + ' (Initial Payment)',
                                    description: 'First month payment collected today'
                                },
                                unit_amount: effectiveAmount,
                            },
                            quantity: 1
                        }

                        // The Subscription Item (will be $0 due now because of trial)
                        const subItem: Stripe.Checkout.SessionCreateParams.LineItem = {
                            price: schedule.stripe_price_id,
                            quantity: 1,
                        }

                        sessionConfig.line_items = [subItem, oneTimeItem]
                    }
                    // Else: Fallback to standard immediate start (matches Start Date ~= Today)
                }
            }
            // Linked Product with Custom Split Payment Amount (Product ID starts with prod_)
            else if (schedule.stripe_price_id && schedule.stripe_price_id.startsWith('prod_')) {
                sessionConfig.line_items = [
                    {
                        price_data: {
                            currency: schedule.currency || 'usd',
                            product: schedule.stripe_price_id, // Link to existing Product
                            unit_amount: effectiveAmount,      // Use the Custom Scheduled Amount
                        },
                        quantity: 1,
                    },
                ]
                sessionConfig.payment_intent_data = {
                    setup_future_usage: 'off_session',
                    metadata: {
                        productId: schedule.stripe_price_id,
                        assignedCoachId: schedule.assigned_coach_id || 'TBD',
                    }
                }
            }
            // Standard One-Time Payment via Price ID
            else if (schedule.stripe_price_id) {
                sessionConfig.line_items = [
                    {
                        price: schedule.stripe_price_id,
                        quantity: 1,
                    },
                ]
                sessionConfig.payment_intent_data = {
                    setup_future_usage: 'off_session',
                }
            }
            // Fallback: Custom Split Payment (Ad-hoc Name)
            else {
                sessionConfig.line_items = [
                    {
                        price_data: {
                            currency: schedule.currency || 'usd',
                            product_data: {
                                name: (schedule.plan_name || 'Payment Plan') + ' (First Payment)',
                            },
                            unit_amount: effectiveAmount,
                        },
                        quantity: 1,
                    },
                ]
                sessionConfig.payment_intent_data = {
                    setup_future_usage: 'off_session',
                }
            }
        }

        console.log('[createCheckoutSessionForSchedule] Config:', JSON.stringify({
            scheduleId,
            amount: effectiveAmount,
            startDate: schedule.start_date,
            isSubscription,
            isSetupMode,
            sessionConfig
        }, null, 2))

        const session = await stripe.checkout.sessions.create(sessionConfig)

        // Update DB with session ID
        await supabase
            .from('payment_schedules')
            .update({ stripe_session_id: session.id })
            .eq('id', scheduleId)

        return { clientSecret: session.client_secret }

    } catch (error: any) {
        console.error('Error creating embedded session:', error)
        return { error: error?.message || 'Failed to initialize payment' }
    }
}

// ... existing createStandardPaymentRef and createSplitPaymentDraft ...


// 2.5 Create Standard Payment Ref (For Pay in Full / Monthly)
export async function createStandardPaymentRef(
    priceId: string,
    type: 'one_time' | 'recurring',
    productName: string,
    amount: number,
    options?: {
        coachId?: string,
        salesCloserId?: string,
        clientId?: string,
        leadId?: string,
        clientTypeId?: string,
        startDate?: string,
        commissionSplits?: any[],
        programTerm?: '6' | '12'
    }
) {
    const supabase = await createClient()

    // 1. Handle Client / Stripe Customer Pre-Check
    if (options?.clientId && options.clientId !== 'new') {
        try {
            await ensureStripeCustomer(createAdminClient(), options.clientId)
        } catch (e) {
            console.error("Failed to ensure stripe customer", e)
            return { error: "Failed to link client to Stripe" }
        }
    }

    try {
        const payload: any = {
            status: 'pending_initial',
            plan_name: productName, // Ensure plan name is saved to DB column
            amount: amount, // Ensure regular amount column is populated
            total_amount: amount,
            remaining_amount: amount,
            payment_type: type, // CRITICAL: Save the payment type (one_time or recurring)
            stripe_price_id: priceId, // CRITICAL: Save the price ID for subscription checkout
            schedule_json: [{
                amount: amount,
                dueDate: new Date().toISOString(),
                status: 'pending'
            }],
            metadata: {
                priceId,
                type,
                productName,
                clientId: options?.clientId,
                leadId: options?.leadId,
                clientTypeId: options?.clientTypeId,
                coachId: options?.coachId,
                salesCloserId: options?.salesCloserId,
                startDate: options?.startDate,
                programTerm: options?.programTerm,
                commissionSplits: options?.commissionSplits
            },
            assigned_coach_id: options?.coachId && options.coachId !== 'tbd' ? options.coachId : null,
            sales_closer_id: options?.salesCloserId && options.salesCloserId !== 'tbd' ? options.salesCloserId : null,
            client_id: options?.clientId || null,
            lead_id: options?.leadId || null,
            client_type_id: options?.clientTypeId || null,
            start_date: options?.startDate || null,
            program_term: options?.programTerm || '6',
            commission_splits: options?.commissionSplits || null
        }

        // Update Client Record if overrides provided (Auto-Update Logic)
        if (options?.clientId && options.clientId !== 'new') {
            const updates: any = {}
            if (options.coachId && options.coachId !== 'tbd') {
                updates.assigned_coach_id = options.coachId
            }
            if (Object.keys(updates).length > 0) {
                // We await this to ensure consistency
                await supabase.from('clients').update(updates).eq('id', options.clientId)
            }
        }

        const { data: schedule, error } = await supabase
            .from('payment_schedules')
            .insert(payload)
            .select('id')
            .single()

        if (error) {
            console.error('Error creating payment schedule:', error)
            return { error: error.message }
        }

        return { id: schedule.id }

    } catch (error: any) {
        console.error('Error creating standard payment ref:', error)
        return { error: error?.message || 'Failed to create reference' }
    }
}

// 3. Create Draft Schedule (Called by Admin)
export async function createSplitPaymentDraft(payload: SplitPaymentPayload) {
    const supabase = createAdminClient()

    // 1. Handle Client / Stripe Customer Pre-Check
    if (payload.clientId && payload.clientId !== 'new') {
        try {
            await ensureStripeCustomer(createAdminClient(), payload.clientId)
        } catch (e) {
            console.error("Failed to ensure stripe customer", e)
            return { error: "Failed to link client to Stripe" }
        }
    }

    try {
        const insertData: any = {
            plan_name: payload.planName,
            amount: payload.downPayment,
            currency: 'usd',
            status: 'draft',
            payment_type: 'split',
            schedule_json: payload.schedule,
            stripe_price_id: payload.productId, // Link to original product/price if provided
        }

        if (payload.coachId && payload.coachId !== 'tbd') {
            insertData.assigned_coach_id = payload.coachId
        }
        if (payload.salesCloserId && payload.salesCloserId !== 'tbd') {
            insertData.sales_closer_id = payload.salesCloserId
        }
        if (payload.clientId) {
            insertData.client_id = payload.clientId
        }
        if (payload.leadId) {
            insertData.lead_id = payload.leadId
        }

        // Add commission splits
        if (payload.commissionSplits && payload.commissionSplits.length > 0) {
            insertData.commission_splits = payload.commissionSplits
        }

        if (payload.startDate) {
            insertData.start_date = payload.startDate
        }

        // Update Client Record if overrides provided (Auto-Update Logic)
        if (payload.clientId && payload.clientId !== 'new') {
            const updates: any = {}
            if (payload.coachId && payload.coachId !== 'tbd') {
                updates.assigned_coach_id = payload.coachId
            }
            if (Object.keys(updates).length > 0) {
                await supabase.from('clients').update(updates).eq('id', payload.clientId)
            }
        }

        // Add program term
        insertData.program_term = payload.programTerm || '6'

        // Create Draft Schedule
        const { data: schedule, error: scheduleError } = await supabase
            .from('payment_schedules')
            .insert(insertData)
            .select()
            .single()

        if (scheduleError) {
            console.error('Error saving payment schedule:', scheduleError)
            return { error: scheduleError.message }
        }

        // Save Future Charges
        if (payload.schedule.length > 0) {
            const chargesData = payload.schedule.map(charge => ({
                schedule_id: schedule.id,
                amount: charge.amount,
                due_date: charge.dueDate,
                status: 'pending',
            }))

            const { error: chargesError } = await supabase
                .from('scheduled_charges')
                .insert(chargesData)

            if (chargesError) {
                console.error('Error saving scheduled charges:', chargesError)
                return { error: chargesError.message }
            }
        }

        return { id: schedule.id }

    } catch (error: any) {
        console.error('Error creating split payment draft:', error)
        return { error: error?.message || 'Failed to create plan' }
    }
}

export async function retrieveCheckoutSession(sessionId: string) {
    try {
        const session = await stripe.checkout.sessions.retrieve(sessionId)
        return {
            status: session.status,
            customer_details: session.customer_details,
            metadata: session.metadata,
        }
    } catch (error) {
        console.error('Error retrieving session:', error)
        return { error: 'Failed to retrieve session' }
    }
}

