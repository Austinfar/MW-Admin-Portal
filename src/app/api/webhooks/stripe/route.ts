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
            const scheduleId = session.metadata?.scheduleId

            if (scheduleId) {
                console.log(`Processing checkout.session.completed for schedule ${scheduleId}`)

                try {
                    // 1. Fetch Schedule with Metadata Columns
                    const { data: schedule, error: startError } = await supabase
                        .from('payment_schedules')
                        .select('*')
                        .eq('id', scheduleId)
                        .single()

                    if (startError || !schedule) {
                        console.error('Schedule not found for webhook:', scheduleId)
                        return new NextResponse('Schedule not found', { status: 404 })
                    }

                    // 2. Update Payment Schedule status and Stripe Details
                    const expandedSession = await stripe.checkout.sessions.retrieve(session.id, {
                        expand: ['payment_intent', 'setup_intent']
                    })

                    const customerId = typeof expandedSession.customer === 'string'
                        ? expandedSession.customer
                        : expandedSession.customer?.id

                    let paymentMethodId: string | null = null
                    if (expandedSession.payment_intent && typeof expandedSession.payment_intent !== 'string') {
                        const pm = expandedSession.payment_intent.payment_method
                        paymentMethodId = typeof pm === 'string' ? pm : pm?.id || null
                    }
                    if (!paymentMethodId && expandedSession.setup_intent && typeof expandedSession.setup_intent !== 'string') {
                        const pm = expandedSession.setup_intent.payment_method
                        paymentMethodId = typeof pm === 'string' ? pm : pm?.id || null
                    }

                    const customerEmail = expandedSession.customer_details?.email

                    await supabase
                        .from('payment_schedules')
                        .update({
                            stripe_customer_id: customerId,
                            stripe_payment_method_id: paymentMethodId,
                            client_email: customerEmail || undefined,
                            status: 'active',
                        })
                        .eq('id', scheduleId)

                    // 3. LEAD CONVERSION LOGIC (If linked to a lead)
                    let finalClientId = schedule.client_id

                    if (schedule.lead_id && !finalClientId) {
                        // Fetch Lead
                        const { data: lead } = await supabase
                            .from('leads')
                            .select('*')
                            .eq('id', schedule.lead_id)
                            .single()

                        if (lead) {
                            console.log(`Converting Lead ${lead.id} to Client...`)

                            // Update lead with Stripe customer ID (for record keeping)
                            if (customerId) {
                                await supabase
                                    .from('leads')
                                    .update({ stripe_customer_id: customerId })
                                    .eq('id', lead.id)
                            }

                            // Insert Client
                            const { data: newClient, error: clientError } = await supabase
                                .from('clients')
                                .insert({
                                    name: `${lead.first_name} ${lead.last_name || ''}`.trim(),
                                    email: lead.email,
                                    phone: lead.phone,
                                    status: 'onboarding',
                                    start_date: schedule.start_date || new Date().toISOString(),
                                    assigned_coach_id: schedule.assigned_coach_id,
                                    client_type_id: schedule.client_type_id,
                                    stripe_customer_id: customerId,
                                    lead_source: 'company_driven', // Or infer from sales_closer
                                    sold_by_user_id: schedule.metadata?.salesCloserId || null
                                    // created_at defaults to now
                                })
                                .select('id')
                                .single()

                            if (newClient) {
                                finalClientId = newClient.id

                                // Link Schedule to new Client
                                await supabase
                                    .from('payment_schedules')
                                    .update({ client_id: finalClientId })
                                    .eq('id', scheduleId)

                                // Create "Client Note" from Lead Description if exists
                                // Assuming we have access to lead description (schema check confirmed description exists)
                                // We might need to cast description if it's not in the select * (it usually is)
                                if ((lead as any).description) {
                                    await supabase.from('client_notes').insert({
                                        client_id: finalClientId,
                                        content: `[Lead Note]: ${(lead as any).description}`,
                                        is_pinned: false,
                                        author_id: schedule.assigned_coach_id  // Assign to coach as fallback author or system
                                    })
                                }

                                // Create Conversion Activity Log
                                await supabase.from('activity_logs').insert({
                                    client_id: finalClientId,
                                    lead_id: lead.id,
                                    type: 'conversion',
                                    description: `Converted from Lead to Client via Payment ${scheduleId}`,
                                    metadata: { source: 'stripe_webhook', amount: schedule.total_amount }
                                })

                                // Migrate all OLD activity logs from Lead -> Client
                                await supabase
                                    .from('activity_logs')
                                    .update({ client_id: finalClientId })
                                    .eq('lead_id', lead.id)

                                // Ensure "Lead Created" log exists (Backfill history)
                                const { data: existingLeadLog } = await supabase
                                    .from('activity_logs')
                                    .select('id')
                                    .eq('lead_id', lead.id)
                                    .eq('type', 'lead_created')
                                    .single()

                                if (!existingLeadLog) {
                                    await supabase.from('activity_logs').insert({
                                        client_id: finalClientId,
                                        lead_id: lead.id,
                                        type: 'lead_created',
                                        description: 'Lead Created (Imported History)',
                                        created_at: lead.created_at, // Preserve original date
                                    })
                                }

                                // Mark Lead Converted (or delete)
                                await supabase.from('leads').update({ status: 'converted' }).eq('id', lead.id)
                            }
                        }
                    } else if (finalClientId) {
                        // If payment was for existing client, just log activity
                        await supabase.from('activity_logs').insert({
                            client_id: finalClientId,
                            type: 'payment',
                            description: `Payment Schedule ${scheduleId} Activated`,
                            metadata: { amount: schedule.total_amount }
                        })
                    }

                    // 4. ONBOARDING TASK ASSIGNMENT
                    if (finalClientId && schedule.client_type_id) {
                        // Fetch Program's Default Template
                        const { data: clientType } = await supabase
                            .from('client_types')
                            .select('default_onboarding_template_id, name')
                            .eq('id', schedule.client_type_id)
                            .single()

                        if (clientType?.default_onboarding_template_id) {
                            console.log(`Assigning Template ${clientType.default_onboarding_template_id} to Client ${finalClientId}`)

                            // Fetch Template Tasks
                            const { data: tasks } = await supabase
                                .from('onboarding_task_templates')
                                .select('*')
                                .eq('template_id', clientType.default_onboarding_template_id)
                                .eq('is_required', true) // Only required ones? Or all? Usually start with all or just required. Let's do all.
                            // Actually, let's respect is_required or not. User probably wants all for checklist.

                            if (tasks && tasks.length > 0) {
                                const today = new Date()
                                const newTasks = tasks.map((t: any) => {
                                    const dueDate = new Date(today)
                                    dueDate.setDate(today.getDate() + (t.due_offset_days || 0))
                                    return {
                                        client_id: finalClientId,
                                        task_template_id: t.id,
                                        title: t.title,
                                        description: t.description,
                                        status: 'pending',
                                        due_date: dueDate.toISOString(),
                                        created_at: new Date().toISOString()
                                    }
                                })

                                await supabase.from('onboarding_tasks').insert(newTasks)

                                await supabase.from('activity_logs').insert({
                                    client_id: finalClientId,
                                    type: 'onboarding',
                                    description: `Assigned Onboarding Tasks for ${clientType.name}`,
                                })
                            }
                        }
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
