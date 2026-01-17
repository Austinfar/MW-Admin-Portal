'use server'

import { stripe } from '@/lib/stripe'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'

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
            product_name: (price.product as Stripe.Product).name,
            unit_amount: price.unit_amount,
            currency: price.currency,
            type: price.type, // 'one_time' or 'recurring'
            recurring: price.recurring,
        }))

        // Check if using test key (starts with sk_test) or derive from price data
        const isTestMode = prices.data.length > 0 ? !prices.data[0].livemode : process.env.STRIPE_SECRET_KEY?.startsWith('sk_test') || false

        return { products, isTestMode }
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
}

// 1. Fetch Schedule Helper
export async function getPaymentSchedule(id: string) {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('payment_schedules')
        .select('*, scheduled_charges(*)')
        .eq('id', id)
        .order('due_date', { foreignTable: 'scheduled_charges', ascending: true })
        .single()

    if (error) return { error: 'Schedule not found' }
    return { data }
}

// 2. Create Embedded Checkout Session (Called by Client on Page Load)
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
            return_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/payment-links?success=true&session_id={CHECKOUT_SESSION_ID}`,
            metadata: {
                scheduleId: schedule.id,
                planName: schedule.plan_name,
                isSplitPayment: (!isSubscription && !schedule.stripe_price_id) ? 'true' : 'false',
                paymentType: schedule.payment_type || 'one_time',
            },
        }

        if (!isSetupMode) {
            // Subscription Mode
            if (isSubscription && schedule.stripe_price_id) {
                sessionConfig.line_items = [
                    {
                        price: schedule.stripe_price_id,
                        quantity: 1,
                    },
                ]
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
                    setup_future_usage: 'off_session', // Optional: save card for later upgrades
                }
            }
            // Custom Split Payment (Ad-hoc Amount)
            else {
                sessionConfig.line_items = [
                    {
                        price_data: {
                            currency: schedule.currency || 'usd',
                            product_data: {
                                name: (schedule.plan_name || 'Payment Plan') + ' (First Payment)',
                            },
                            unit_amount: schedule.amount, // Ad-hoc amount
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

// 2.5 Create Standard Payment Ref (For Pay in Full / Monthly)
export async function createStandardPaymentRef(priceId: string, type: 'one_time' | 'recurring', productName: string, amount: number) {
    const supabase = await createClient()

    try {
        const { data: schedule, error } = await supabase
            .from('payment_schedules')
            .insert({
                plan_name: productName,
                amount: amount, // For display & initial sorting, though subscription ignores this for billing
                currency: 'usd',
                status: 'draft',
                payment_type: type,
                stripe_price_id: priceId,
            })
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
        // Create Draft Schedule
        const { data: schedule, error: scheduleError } = await supabase
            .from('payment_schedules')
            .insert({
                plan_name: payload.planName,
                amount: payload.downPayment,
                currency: 'usd',
                status: 'draft',
            })
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
