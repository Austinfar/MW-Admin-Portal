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

export async function createPaymentLink(priceId: string) {
    try {
        const session = await stripe.paymentLinks.create({
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                    // adjustable_quantity: { enabled: true, minimum: 1, maximum: 10 },
                },
            ],
            after_completion: {
                type: 'hosted_confirmation',
            },
        })

        return { url: session.url }
    } catch (error) {
        console.error('Error creating payment link:', error)
        return { error: 'Failed to create payment link' }
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
}

// ... existing helper methods ...

// 0. Fetch Coaches for Selector
export async function getCoaches() {
    // USE ADMIN CLIENT to bypass RLS and ensure we see all coaches
    const supabase = createAdminClient()

    // Fetch users with role 'coach' or 'admin' (if admins also coach)
    const { data: coaches, error } = await supabase
        .from('users')
        .select('id, name, avatar_url')
        .in('role', ['coach', 'admin'])
        .eq('is_active', true)
        .order('name')

    if (error) {
        console.error('Error fetching coaches:', error)
        return []
    }
    return coaches || []
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
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('payment_schedules')
        .select('*, scheduled_charges(*), coach:users!assigned_coach_id(name)') // Join users table to get coach name
        .eq('id', id)
        .order('due_date', { foreignTable: 'scheduled_charges', ascending: true })
        .single()

    if (error) return { error: 'Schedule not found' }
    return { data }
}

// 2. Create Embedded Checkout Session (Called by Client on Page Load or after Update)
export async function createCheckoutSessionForSchedule(scheduleId: string) {
    const supabase = await createClient()

    // Fetch Schedule
    const { data: schedule } = await supabase
        .from('payment_schedules')
        .select('*')
        .eq('id', scheduleId)
        .single()

    if (!schedule) return { error: 'Schedule not found' }

    try {
        const isSetupMode = schedule.amount === 0
        const isSubscription = schedule.payment_type === 'recurring'

        const sessionConfig: Stripe.Checkout.SessionCreateParams = {
            ui_mode: 'embedded',
            mode: isSetupMode ? 'setup' : (isSubscription ? 'subscription' : 'payment'),
            payment_method_types: ['card'],
            return_url: `${process.env.NEXT_PUBLIC_PAYMENT_URL || process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')}/success?session_id={CHECKOUT_SESSION_ID}`,
            metadata: {
                scheduleId: schedule.id,
                planName: schedule.plan_name,
                isSplitPayment: (!isSubscription && !schedule.stripe_price_id) ? 'true' : 'false',
                paymentType: schedule.payment_type || 'one_time',
                assignedCoachId: schedule.assigned_coach_id || 'TBD',
                startDate: schedule.start_date || 'Not Set'
            },
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
                                unit_amount: schedule.amount,
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
                            unit_amount: schedule.amount,      // Use the Custom Scheduled Amount
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
                            unit_amount: schedule.amount,
                        },
                        quantity: 1,
                    },
                ]
                sessionConfig.payment_intent_data = {
                    setup_future_usage: 'off_session',
                }
            }
        }

        const session = await stripe.checkout.sessions.create(sessionConfig)

        // Update DB with session ID
        await supabase
            .from('payment_schedules')
            .update({ stripe_session_id: session.id })
            .eq('id', scheduleId)

        return { clientSecret: session.client_secret }

    } catch (error) {
        console.error('Error creating embedded session:', error)
        return { error: 'Failed to initialize payment' }
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
        startDate?: string
    }
) {
    const supabase = await createClient()

    try {
        const payload: any = {
            plan_name: productName,
            amount: amount, // For display & initial sorting, though subscription ignores this for billing
            currency: 'usd',
            status: 'draft',
            payment_type: type,
            stripe_price_id: priceId,
        }

        if (options?.coachId && options.coachId !== 'tbd') {
            payload.assigned_coach_id = options.coachId
        }
        if (options?.startDate) {
            payload.start_date = options.startDate
        }

        const { data: schedule, error } = await supabase
            .from('payment_schedules')
            .insert(payload)
            .select()
            .single()

        if (error) {
            console.error('Error creating standard payment ref:', error)
            return { error: 'Database error' }
        }

        return { id: schedule.id }
    } catch (error) {
        console.error('Error creating standard payment ref:', error)
        return { error: 'Failed to create reference' }
    }
}

// 3. Create Draft Schedule (Called by Admin)
export async function createSplitPaymentDraft(payload: SplitPaymentPayload) {
    const supabase = await createClient()

    try {
        const insertData: any = {
            plan_name: payload.planName,
            amount: payload.downPayment,
            currency: 'usd',
            status: 'draft',
            stripe_price_id: payload.productId, // Link to original product/price if provided
        }

        if (payload.coachId && payload.coachId !== 'tbd') {
            insertData.assigned_coach_id = payload.coachId
        }
        if (payload.startDate) {
            insertData.start_date = payload.startDate
        }

        // Create Draft Schedule
        const { data: schedule, error: scheduleError } = await supabase
            .from('payment_schedules')
            .insert(insertData)
            .select()
            .single()

        if (scheduleError) {
            console.error('Error saving payment schedule:', scheduleError)
            return { error: 'Database error creating schedule' }
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
                return { error: 'Database error saving charges' }
            }
        }

        return { id: schedule.id }

    } catch (error) {
        console.error('Error creating split payment draft:', error)
        return { error: 'Failed to create plan' }
    }
}
