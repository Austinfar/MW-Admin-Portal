import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { calculateCommission } from '@/lib/logic/commissions'
import Stripe from 'stripe'

export async function POST(req: Request) {
    const body = await req.text()
    const signature = (await headers()).get('Stripe-Signature') as string

    if (!process.env.STRIPE_WEBHOOK_SECRET) {
        return new NextResponse('STRIPE_WEBHOOK_SECRET is missing', { status: 500 })
    }

    let event: Stripe.Event

    try {
        event = stripe.webhooks.constructEvent(
            body,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET
        )
    } catch (error: any) {
        console.error(`Webhook signature verification failed: ${error.message}`)
        return new NextResponse(`Webhook Error: ${error.message}`, { status: 400 })
    }

    const supabase = createAdminClient()

    // Handle specific events
    try {
        if (event.type === 'payment_intent.succeeded') {
            const paymentIntent = event.data.object as Stripe.PaymentIntent

            // Extract basic data
            const stripePaymentId = paymentIntent.id
            const amount = paymentIntent.amount / 100 // Convert cents to dollars (or whatever unit based on currency)
            const currency = paymentIntent.currency
            const status = paymentIntent.status
            const created = new Date(paymentIntent.created * 1000).toISOString()
            const stripeCustomerId = typeof paymentIntent.customer === 'string' ? paymentIntent.customer : paymentIntent.customer?.id || null
            const description = paymentIntent.description

            // Attempt to find client email from receipt_email or metadata or customer object if I fetched it.
            // PaymentIntent usually has receipt_email.
            let clientEmail = paymentIntent.receipt_email

            // If no email on PI, maybe try to fetch customer? (Optional optimization)

            let clientId: string | null = null

            // MATCHING LOGIC
            if (clientEmail) {
                const { data: client } = await supabase
                    .from('clients')
                    .select('id, stripe_customer_id')
                    .eq('email', clientEmail)
                    .single()

                if (client) {
                    clientId = client.id
                    // Update client stripe_customer_id if missing
                    if (!client.stripe_customer_id && stripeCustomerId) {
                        await supabase.from('clients').update({ stripe_customer_id: stripeCustomerId }).eq('id', client.id)
                    }
                }
            }

            // Also try matching by stripe_customer_id if email match failed or didn't exist
            if (!clientId && stripeCustomerId) {
                const { data: client } = await supabase
                    .from('clients')
                    .select('id')
                    .eq('stripe_customer_id', stripeCustomerId)
                    .single()

                if (client) {
                    clientId = client.id
                }
            }

            // Upsert Payment
            const { error } = await supabase.from('payments').upsert({
                stripe_payment_id: stripePaymentId,
                amount,
                currency,
                status,
                created,
                client_email: clientEmail ?? null,
                stripe_customer_id: stripeCustomerId,
                client_id: clientId,
                description,
            }, {
                onConflict: 'stripe_payment_id'
            })

            if (error) {
                console.error('Error upserting payment:', error)
                return new NextResponse('Database Error', { status: 500 })
            }

            // Trigger Commission Calculation
            // We need to fetch the inserted ID
            const { data: insertedPayment } = await supabase
                .from('payments')
                .select('id')
                .eq('stripe_payment_id', stripePaymentId)
                .single()

            if (insertedPayment) {
                await calculateCommission(insertedPayment.id)
            }
        }

        if (event.type === 'checkout.session.completed') {
            const session = event.data.object as Stripe.Checkout.Session

            // Check if this session is related to a Payment Schedule
            // We store scheduleId in metadata
            const scheduleId = session.metadata?.scheduleId

            if (scheduleId) {
                console.log(`Processing checkout.session.completed for schedule ${scheduleId}`)

                // We need to fetch the session with expansion to retrieve the payment method
                // because the event object might not have it expanded, or we want to be sure.
                // Or identifying the method from the PaymentIntent.

                try {
                    // Retrieve fresh session with expansions
                    const expandedSession = await stripe.checkout.sessions.retrieve(session.id, {
                        expand: ['payment_intent', 'setup_intent']
                    })

                    const customerId = typeof expandedSession.customer === 'string'
                        ? expandedSession.customer
                        : expandedSession.customer?.id

                    let paymentMethodId: string | null = null

                    // Extract PM from PaymentIntent
                    if (expandedSession.payment_intent && typeof expandedSession.payment_intent !== 'string') {
                        const pm = expandedSession.payment_intent.payment_method
                        paymentMethodId = typeof pm === 'string' ? pm : pm?.id || null
                    }

                    // Fallback to SetupIntent if enabled (e.g. for subscription setup mode)
                    if (!paymentMethodId && expandedSession.setup_intent && typeof expandedSession.setup_intent !== 'string') {
                        const pm = expandedSession.setup_intent.payment_method
                        paymentMethodId = typeof pm === 'string' ? pm : pm?.id || null
                    }

                    const customerEmail = expandedSession.customer_details?.email

                    // Update payment_schedules
                    if (customerId && paymentMethodId) {
                        const { error } = await supabase
                            .from('payment_schedules')
                            .update({
                                stripe_customer_id: customerId,
                                stripe_payment_method_id: paymentMethodId,
                                client_email: customerEmail || undefined,
                                status: 'active', // Mark active so cron picks up future charges
                            })
                            .eq('id', scheduleId)

                        if (error) {
                            console.error('Error updating payment schedule:', error)
                        } else {
                            console.log(`Updated schedule ${scheduleId} with customer ${customerId}`)
                        }
                    } else {
                        console.warn(`Missing customer or PM for schedule ${scheduleId}`)
                    }

                } catch (err) {
                    console.error('Error processing checkout session:', err)
                }
            }
        }
        // Add other events like 'payment_intent.payment_failed' if needed
    } catch (err: any) {
        console.error('Webhook handler error:', err)
        return new NextResponse('Internal Server Error', { status: 500 })
    }

    return new NextResponse('ok', { status: 200 })
}
