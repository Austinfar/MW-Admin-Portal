'use client'

import Image from 'next/image'
import { useCallback, useEffect, useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import {
    EmbeddedCheckoutProvider,
    EmbeddedCheckout,
} from '@stripe/react-stripe-js'
import { toast } from 'sonner'
import { Loader2, ShieldCheck, CalendarIcon, UserCircle } from 'lucide-react'
import { format } from 'date-fns'

import { getPaymentSchedule, createCheckoutSessionForSchedule } from '@/lib/actions/stripe-actions'
import { cn } from '@/lib/utils'

// Initialize Stripe outside component
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

export default function PayPage({ params }: { params: Promise<{ id: string }> }) {
    const [clientSecret, setClientSecret] = useState<string | null>(null)
    const [schedule, setSchedule] = useState<any | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    const fetchSession = useCallback(async () => {
        setIsLoading(true)
        try {
            const resolvedParams = await params
            const { id } = resolvedParams

            // 1. Fetch Schedule Details
            const response = await getPaymentSchedule(id)

            if (response.error || !response.data) {
                setError(response.error || "Payment link not found or expired.")
                setIsLoading(false)
                return
            }

            const scheduleData = response.data
            setSchedule(scheduleData)

            if (scheduleData.status === 'paid') {
                // If already paid, maybe redirect or show message?
                // For now, let Stripe handle it, or show a completed state?
                // Stripe Embedded Checkout handles "already paid" nicely usually, or we can just let it load.
            }

            // 2. Create Stripe Checkout Session (Server Action)
            // This now uses the StartDate/CoachId ALREADY saved in the DB by the admin.
            const result = await createCheckoutSessionForSchedule(id)

            if (result.error) {
                setError(result.error)
            } else if (result.clientSecret) {
                setClientSecret(result.clientSecret)
            }
        } catch (err) {
            console.error(err)
            setError("Failed to load payment session.")
        } finally {
            setIsLoading(false)
        }
    }, [params])

    useEffect(() => {
        fetchSession()
    }, [fetchSession])

    if (error) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-black text-white p-4">
                <div className="text-center space-y-4 max-w-md">
                    <p className="text-red-400 font-medium">{error}</p>
                    <p className="text-sm text-zinc-500">Please contact support if you believe this is an error.</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-black text-white font-sans selection:bg-neon-green/30 selection:text-neon-green">
            {/* Trust/Verification Header */}
            <div className="w-full bg-zinc-900/50 border-b border-white/10 py-2">
                <div className="max-w-5xl mx-auto px-4 flex items-center justify-center text-[10px] sm:text-xs tracking-wider uppercase text-zinc-400 font-medium gap-2">
                    <ShieldCheck className="w-3 h-3 text-neon-green" />
                    <span>Secure Payment via Stripe</span>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-4 py-8 md:py-12">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 space-y-4">
                        <Loader2 className="w-8 h-8 animate-spin text-neon-green" />
                        <p className="text-zinc-500 text-sm animate-pulse">Preparing secure checkout...</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
                        {/* LEFT COLUMN: Order Summary (Context) */}
                        <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-8 h-fit">
                            <div className="space-y-2">
                                <h1 className="text-2xl md:text-3xl font-light text-white tracking-tight">
                                    {schedule?.plan_name || 'Coaching Package'}
                                </h1>
                                <p className="text-zinc-400 text-sm leading-relaxed">
                                    Complete your enrollment below.
                                </p>
                            </div>

                            <div className="bg-zinc-900/40 border border-white/5 rounded-xl p-6 space-y-4 backdrop-blur-sm">
                                <div className="flex justify-between items-start pb-4 border-b border-white/5">
                                    <span className="text-sm text-zinc-400">Total Due Now</span>
                                    <div className="text-right">
                                        <span className="text-xl font-medium text-white block">
                                            {formatCurrency(schedule?.amount || 0, schedule?.currency || 'usd')}
                                        </span>
                                    </div>
                                </div>

                                {/* Dynamic Details Display */}
                                <div className="space-y-3 pt-2">
                                    {/* Show Coach if assigned */}
                                    {schedule?.assigned_coach_id && (
                                        <div className="flex items-center justify-between text-sm">
                                            <div className="flex items-center text-zinc-500 gap-2">
                                                <UserCircle className="w-4 h-4" />
                                                <span>Assigned Coach</span>
                                            </div>
                                            <span className="text-zinc-300 font-medium">
                                                {/* @ts-ignore - joined prop */}
                                                {schedule.coach?.name || "Confirmed"}
                                            </span>
                                        </div>
                                    )}

                                    {/* Show Start Date */}
                                    {schedule?.start_date && (
                                        <div className="flex items-center justify-between text-sm">
                                            <div className="flex items-center text-zinc-500 gap-2">
                                                <CalendarIcon className="w-4 h-4" />
                                                <span>Start Date</span>
                                            </div>
                                            <span className="text-zinc-300 font-medium">
                                                {format(new Date(schedule.start_date), 'MMMM do, yyyy')}
                                            </span>
                                        </div>
                                    )}

                                    {/* Recurring Info */}
                                    {schedule?.payment_type === 'recurring' && schedule?.start_date && (
                                        <div className="bg-neon-green/5 border border-neon-green/10 rounded-lg p-3 mt-2">
                                            <p className="text-xs text-neon-green/90 leading-relaxed">
                                                <strong>Billing Schedule:</strong> Your first month is collected today. Your recurring billing cycle will officially begin on <strong>{format(addOneMonth(new Date(schedule.start_date)), 'MMM do')}</strong>.
                                            </p>
                                        </div>
                                    )}

                                    {/* Payment Type Badge */}
                                    <div className="pt-4 flex gap-2">
                                        {schedule?.payment_type === 'recurring' ? (
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                                Monthly Subscription
                                            </span>
                                        ) : schedule.isSplitPayment === 'true' || schedule.plan_name?.toLowerCase().includes('split') ? ( // simplified check
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                                Installment Plan
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-800 text-zinc-300 border border-white/10">
                                                One-Time Payment
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 text-xs text-zinc-500 pt-2">
                                    <ShieldCheck className="w-3 h-3" />
                                    <span>Encrypted 256-bit SSL connection</span>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT COLUMN: Stripe Checkout */}
                        <div className="lg:col-span-7">
                            {clientSecret && (
                                <div className="bg-white rounded-xl shadow-2xl shadow-black/50 overflow-hidden min-h-[400px]">
                                    <EmbeddedCheckoutProvider
                                        stripe={stripePromise}
                                        options={{ clientSecret }}
                                    >
                                        <EmbeddedCheckout className="h-full w-full" />
                                    </EmbeddedCheckoutProvider>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

function formatCurrency(amount: number, currency: string) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency.toUpperCase(),
    }).format(amount / 100)
}

function addOneMonth(date: Date) {
    const d = new Date(date)
    d.setMonth(d.getMonth() + 1)
    return d
}
