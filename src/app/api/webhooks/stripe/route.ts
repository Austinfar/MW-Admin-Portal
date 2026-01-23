import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { calculateCommission } from '@/lib/logic/commissions'
import { handleRefund, handleDisputeCreated, handleDisputeClosed } from '@/lib/logic/chargebacks'
import { executePostPaymentFlow, type PostPaymentContext } from '@/lib/logic/post-payment'
import {
    handleSubscriptionUpdated,
    handleSubscriptionDeleted,
    handleInvoicePaymentFailed
} from '@/lib/logic/subscription-webhooks'
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

            // Fetch the actual Stripe fee from the charge's balance transaction
            let stripeFee: number | null = null
            let clientEmail = paymentIntent.receipt_email

            try {
                // Fetch the PaymentIntent with expanded charge and balance_transaction
                const expandedPI = await stripe.paymentIntents.retrieve(paymentIntent.id, {
                    expand: ['latest_charge.balance_transaction']
                })

                const charge = expandedPI.latest_charge as Stripe.Charge | null
                if (charge) {
                    // Get email from charge if not on payment intent
                    if (!clientEmail) {
                        clientEmail = charge.billing_details?.email || charge.receipt_email || null
                    }

                    // Get actual fee from balance transaction
                    const balanceTransaction = charge.balance_transaction as Stripe.BalanceTransaction | null
                    if (balanceTransaction && typeof balanceTransaction !== 'string') {
                        // Fee is in cents, convert to dollars
                        stripeFee = balanceTransaction.fee / 100
                    }
                }
            } catch (fetchError) {
                console.error('Error fetching expanded payment intent for fee:', fetchError)
            }

            // Fall back to estimated fee if we can't fetch the real one (or if fetch succeeded but yielded no fee)
            if (stripeFee === null) {
                stripeFee = Number((amount * 0.029 + 0.30).toFixed(2))
            }

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

            // Calculate net amount
            const netAmount = stripeFee !== null ? amount - stripeFee : null

            // Upsert Payment
            // Note: 'created' and 'description' columns don't exist in payments table
            // Using payment_date for the timestamp, product_name for description if needed
            const { error } = await supabase.from('payments').upsert({
                stripe_payment_id: stripePaymentId,
                amount,
                stripe_fee: stripeFee,
                net_amount: netAmount,
                currency,
                status,
                payment_date: created,
                client_email: clientEmail ?? null,
                stripe_customer_id: stripeCustomerId,
                client_id: clientId,
                product_name: description || null, // Map description to product_name
            }, {
                onConflict: 'stripe_payment_id'
            })

            if (error) {
                console.error('Error upserting payment:', JSON.stringify(error, null, 2))
                return new NextResponse(`Database Error: ${error.message || error.code || 'Unknown'}`, { status: 500 })
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
                        expand: ['payment_intent', 'setup_intent', 'line_items.data.price.product']
                    })

                    // Extract product name from line items
                    let stripeProductName: string | null = null
                    const lineItems = expandedSession.line_items?.data
                    if (lineItems && lineItems.length > 0) {
                        const firstItem = lineItems[0]
                        const product = firstItem.price?.product
                        if (product && typeof product !== 'string' && 'name' in product) {
                            stripeProductName = product.name || null
                        }
                    }

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
                            ...(stripeProductName && { stripe_product_name: stripeProductName }),
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

                            // Insert Client (copy appointment_setter_id from lead)
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
                                    sold_by_user_id: schedule.metadata?.salesCloserId || null,
                                    // Copy appointment setter from lead
                                    appointment_setter_id: (lead as any).booked_by_user_id || null,
                                    // Initialize coach_history with current coach
                                    coach_history: schedule.assigned_coach_id ? [{
                                        coach_id: schedule.assigned_coach_id,
                                        start_date: new Date().toISOString().split('T')[0],
                                        end_date: null
                                    }] : []
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
                                if ((lead as any).description) {
                                    await supabase.from('client_notes').insert({
                                        client_id: finalClientId,
                                        content: `[Lead Note]: ${(lead as any).description}`,
                                        is_pinned: false,
                                        author_id: schedule.assigned_coach_id
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

                                // Ensure "Lead Created" log exists
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
                                        created_at: lead.created_at,
                                    })
                                }

                                // Mark Lead Converted
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

                    // CRITICAL FIX: Link the payment to the client
                    // failed_payment_intent often races ahead of checkout.session.completed
                    if (finalClientId) {
                        let paymentIntentId = expandedSession.payment_intent;
                        if (typeof paymentIntentId !== 'string') {
                            paymentIntentId = paymentIntentId?.id || null;
                        }

                        if (paymentIntentId) {
                            console.log(`Linking payment ${paymentIntentId} to client ${finalClientId}`);
                            await supabase
                                .from('payments')
                                .update({ client_id: finalClientId })
                                .eq('stripe_payment_id', paymentIntentId);

                            // Also ensure commission is calculated if it was skipped due to missing client
                            const { data: payRec } = await supabase
                                .from('payments')
                                .select('id, commission_calculated')
                                .eq('stripe_payment_id', paymentIntentId)
                                .single();

                            if (payRec && !payRec.commission_calculated) {
                                await calculateCommission(payRec.id);
                            }
                        }
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

                    // 5. POST-PAYMENT FLOW (Slack notifications, internal notifications)
                    if (finalClientId) {
                        // Fetch the client to get all needed info for notifications
                        const { data: clientForNotif } = await supabase
                            .from('clients')
                            .select('name, email, appointment_setter_id, ghl_contact_id')
                            .eq('id', finalClientId)
                            .single()

                        // Fetch lead description if this was a conversion (for client goal)
                        let clientGoal: string | null = null
                        if (schedule.lead_id) {
                            const { data: leadData } = await supabase
                                .from('leads')
                                .select('description')
                                .eq('id', schedule.lead_id)
                                .single()
                            clientGoal = leadData?.description || null
                        }

                        // Use Stripe product name (fresh or stored), fall back to plan_name or client type
                        let programName = stripeProductName || schedule.stripe_product_name || schedule.plan_name || 'Coaching Program'
                        if (!stripeProductName && !schedule.stripe_product_name && schedule.client_type_id) {
                            const { data: ct } = await supabase
                                .from('client_types')
                                .select('name')
                                .eq('id', schedule.client_type_id)
                                .single()
                            if (ct?.name) programName = ct.name
                        }

                        // Extract referrer from commission splits
                        const commissionSplits = (schedule.commission_splits as Array<{ userId: string; role: string }>) || []
                        const referrer = commissionSplits.find(s => s.role === 'Referrer')

                        // Calculate payment amounts
                        // amount = initial payment in cents, total_amount = full program value
                        const initialPaymentCents = schedule.amount || 0
                        const totalProgramCents = schedule.total_amount || initialPaymentCents
                        const remainingCents = schedule.remaining_amount || 0
                        const cashCollectedCents = totalProgramCents - remainingCents

                        // Parse program length from program_term field (stored as string like "6")
                        const programLengthMonths = schedule.program_term
                            ? parseInt(schedule.program_term, 10) || null
                            : null

                        // Map payment_type to our enum
                        const paymentType = schedule.payment_type === 'paid_in_full'
                            ? 'paid_in_full' as const
                            : schedule.payment_type === 'split'
                                ? 'split' as const
                                : schedule.payment_type === 'recurring' || schedule.payment_type === 'subscription'
                                    ? 'subscription' as const
                                    : null

                        const postPaymentContext: PostPaymentContext = {
                            clientId: finalClientId,
                            clientName: clientForNotif?.name || 'Client',
                            clientEmail: clientForNotif?.email || customerEmail || '',
                            clientGoal,
                            programName,
                            paymentAmount: initialPaymentCents / 100, // Convert cents to dollars
                            totalProgramValue: totalProgramCents / 100,
                            cashCollected: cashCollectedCents / 100,
                            programLengthMonths,
                            paymentType,
                            closerId: schedule.metadata?.salesCloserId || null,
                            setterId: clientForNotif?.appointment_setter_id || null,
                            referrerId: referrer?.userId || null,
                            coachId: schedule.assigned_coach_id || null,
                            commissions: [], // Commissions are calculated separately via payment_intent.succeeded
                        }

                        // Execute async (don't block webhook response)
                        executePostPaymentFlow(postPaymentContext).catch(err => {
                            console.error('[Post-Payment] Flow error:', err)
                        })
                    }

                } catch (err) {
                    console.error('Error processing checkout session:', err)
                }
            }
        }
        // Handle Refunds
        if (event.type === 'charge.refunded') {
            const charge = event.data.object as Stripe.Charge
            console.log('Processing charge.refunded event')
            await handleRefund(charge)
        }

        // Handle Disputes
        if (event.type === 'charge.dispute.created') {
            const dispute = event.data.object as Stripe.Dispute
            console.log('Processing charge.dispute.created event')
            await handleDisputeCreated(dispute)
        }

        if (event.type === 'charge.dispute.closed') {
            const dispute = event.data.object as Stripe.Dispute
            console.log('Processing charge.dispute.closed event')
            await handleDisputeClosed(dispute)
        }

        // Handle subscription invoice payments (for legacy subscriptions)
        if (event.type === 'invoice.paid') {
            // Use 'any' to handle different Stripe API versions
            const invoice = event.data.object as any

            // Only process subscription invoices
            const subscriptionId = invoice.subscription
            if (subscriptionId) {
                const subId = typeof subscriptionId === 'string'
                    ? subscriptionId
                    : subscriptionId.id

                // Check if we have commission config for this subscription
                const { data: config } = await supabase
                    .from('subscription_commission_config')
                    .select('*')
                    .eq('stripe_subscription_id', subId)
                    .eq('is_active', true)
                    .single()

                if (config && config.client_id) {
                    console.log(`Processing invoice.paid for configured subscription ${subId}`)

                    // Create payment record
                    const amount = (invoice.amount_paid || 0) / 100

                    const paymentIntentId = invoice.payment_intent
                    const stripePaymentId = typeof paymentIntentId === 'string'
                        ? paymentIntentId
                        : paymentIntentId?.id || invoice.id

                    // Fetch actual Stripe fee from charge's balance transaction
                    let stripeFee: number | null = null
                    try {
                        if (typeof paymentIntentId === 'string') {
                            const expandedPI = await stripe.paymentIntents.retrieve(paymentIntentId, {
                                expand: ['latest_charge.balance_transaction']
                            })
                            const charge = expandedPI.latest_charge as Stripe.Charge | null
                            if (charge) {
                                const balanceTransaction = charge.balance_transaction as Stripe.BalanceTransaction | null
                                if (balanceTransaction && typeof balanceTransaction !== 'string') {
                                    stripeFee = balanceTransaction.fee / 100
                                }
                            }
                        }
                    } catch (fetchError) {
                        console.error('Error fetching actual Stripe fee for invoice:', fetchError)
                    }

                    // Fall back to estimated fee if we couldn't fetch the real one
                    if (stripeFee === null) {
                        stripeFee = Number((amount * 0.029 + 0.30).toFixed(2))
                    }

                    const netAmount = amount - stripeFee

                    // Check if payment already exists (avoid duplicates)
                    const { data: existingPayment } = await supabase
                        .from('payments')
                        .select('id')
                        .eq('stripe_payment_id', stripePaymentId)
                        .single()

                    if (existingPayment) {
                        console.log(`Payment ${stripePaymentId} already exists, skipping`)
                    } else {
                        const { data: payment, error: paymentError } = await supabase
                            .from('payments')
                            .insert({
                                stripe_payment_id: stripePaymentId,
                                amount,
                                stripe_fee: stripeFee,
                                net_amount: netAmount,
                                currency: invoice.currency,
                                status: 'succeeded',
                                client_id: config.client_id,
                                client_email: invoice.customer_email,
                                stripe_customer_id: typeof invoice.customer === 'string'
                                    ? invoice.customer
                                    : invoice.customer?.id,
                                description: `Subscription payment: ${invoice.lines?.data?.[0]?.description || 'Recurring'}`,
                                created: new Date(invoice.created * 1000).toISOString(),
                                payment_date: new Date(invoice.created * 1000).toISOString()
                            })
                            .select('id')
                            .single()

                        if (payment && !paymentError) {
                            // Update client with subscription config settings if not already set
                            const updates: Record<string, unknown> = {}
                            if (config.assigned_coach_id) {
                                updates.assigned_coach_id = config.assigned_coach_id
                            }
                            if (config.appointment_setter_id) {
                                updates.appointment_setter_id = config.appointment_setter_id
                            }
                            if (config.lead_source) {
                                updates.lead_source = config.lead_source
                            }
                            if (typeof config.is_resign === 'boolean') {
                                updates.is_resign = config.is_resign
                            }

                            if (Object.keys(updates).length > 0) {
                                await supabase
                                    .from('clients')
                                    .update(updates)
                                    .eq('id', config.client_id)
                            }

                            // Create a temporary payment_schedule record for commission calculation
                            // This allows the commission calculator to find the commission_splits
                            if (config.commission_splits && (config.commission_splits as any[]).length > 0) {
                                await supabase
                                    .from('payment_schedules')
                                    .upsert({
                                        id: `sub-${subId}`, // Use subscription ID as unique identifier
                                        client_id: config.client_id,
                                        assigned_coach_id: config.assigned_coach_id,
                                        commission_splits: config.commission_splits,
                                        status: 'active',
                                        plan_name: `Subscription ${subId}`,
                                        payment_type: 'recurring',
                                    }, {
                                        onConflict: 'id'
                                    })
                            }

                            // Trigger commission calculation
                            await calculateCommission(payment.id)
                        }
                    }
                }
            }
        }

        // Handle subscription updates (pause, resume, plan changes)
        if (event.type === 'customer.subscription.updated') {
            const subscription = event.data.object as Stripe.Subscription
            console.log('Processing customer.subscription.updated event')
            await handleSubscriptionUpdated(subscription)
        }

        // Handle subscription deletions (cancellations)
        if (event.type === 'customer.subscription.deleted') {
            const subscription = event.data.object as Stripe.Subscription
            console.log('Processing customer.subscription.deleted event')
            await handleSubscriptionDeleted(subscription)
        }

        // Handle failed invoice payments
        if (event.type === 'invoice.payment_failed') {
            const invoice = event.data.object as Stripe.Invoice
            console.log('Processing invoice.payment_failed event')
            await handleInvoicePaymentFailed(invoice)
        }
    } catch (err: any) {
        console.error('Webhook handler error:', err)
        return new NextResponse('Internal Server Error', { status: 500 })
    }

    return new NextResponse('ok', { status: 200 })
}
