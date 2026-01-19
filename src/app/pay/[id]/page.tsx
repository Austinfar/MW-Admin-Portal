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
        <div className="min-h-screen bg-black text-white font-sans selection:bg-neon-green/30 selection:text-neon-green relative overflow-hidden">
            {/* Ambient Background Glow - subtle and premium */}
            <div className="fixed top-[-20%] left-[-10%] w-[500px] h-[500px] bg-neon-green/10 blur-[100px] rounded-full pointer-events-none" />
            <div className="fixed bottom-[-10%] right-[-5%] w-[300px] h-[300px] bg-neon-green/5 blur-[80px] rounded-full pointer-events-none" />

            {/* Trust/Verification Header */}
            <div className="relative z-10 w-full bg-zinc-900/30 border-b border-white/5 backdrop-blur-md py-2">
                <div className="max-w-5xl mx-auto px-4 flex items-center justify-center text-[10px] sm:text-xs tracking-widest uppercase text-neon-green font-medium gap-2">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Secure Payment via Stripe</span>
                </div>
            </div>

            <div className="relative z-10 max-w-5xl mx-auto px-6 py-8 md:py-12">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 space-y-6">
                        <Loader2 className="w-10 h-10 animate-spin text-neon-green" />
                        <p className="text-zinc-500 text-sm tracking-widest uppercase font-medium animate-pulse">Initializing Secure Checkout...</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
                        {/* LEFT COLUMN: Brand & Order Context */}
                        <div className="lg:col-span-5 space-y-8 lg:sticky lg:top-8 h-fit">

                            {/* Brand Logo */}
                            <div className="relative w-40 h-auto">
                                <Image
                                    src="/logo-white.svg"
                                    alt="MW Systems"
                                    width={160}
                                    height={48}
                                    className="object-contain drop-shadow-[0_0_15px_rgba(74,222,128,0.3)]"
                                    priority
                                />
                            </div>

                            <div className="space-y-3">
                                <h1 className="text-3xl font-light text-white tracking-tight leading-tight">
                                    {schedule?.plan_name || 'Coaching Package'}
                                </h1>
                                <p className="text-zinc-400 text-base font-light leading-relaxed">
                                    {getPlanDescription(schedule?.plan_name)}
                                </p>
                            </div>

                            {/* Order Summary Card */}
                            <div className="relative group">
                                <div className="absolute -inset-0.5 bg-gradient-to-r from-neon-green/20 to-transparent rounded-2xl blur opacity-50 group-hover:opacity-100 transition duration-1000"></div>
                                <div className="relative bg-zinc-900/80 border border-white/10 rounded-2xl p-6 space-y-5 backdrop-blur-xl shadow-2xl">

                                    <div className="flex justify-between items-end pb-5 border-b border-white/5">
                                        <span className="text-xs uppercase tracking-wider text-zinc-500 font-medium">Total Due Now</span>
                                        <div className="text-right">
                                            <span className="text-3xl font-semibold text-white drop-shadow-sm">
                                                {formatCurrency(schedule?.amount || 0, schedule?.currency || 'usd')}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Dynamic Details Display */}
                                    <div className="space-y-4">

                                        {/* Coach Display - Always Show */}
                                        <div className="flex items-center justify-between group/coach">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center border border-white/5 ring-2 ring-transparent group-hover/coach:ring-neon-green/30 transition-all">
                                                    <UserCircle className="w-5 h-5 text-zinc-400 group-hover/coach:text-white transition-colors" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] text-zinc-500 uppercase tracking-wide">Assigned Coach</span>
                                                    <span className="text-white text-sm font-medium">
                                                        {/* @ts-ignore - joined prop */}
                                                        {schedule?.coach?.name || "TBD"}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Start Date */}
                                        {schedule?.start_date && (
                                            <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/5 border border-white/5">
                                                <div className="flex items-center text-zinc-400 gap-2.5">
                                                    <CalendarIcon className="w-4 h-4" />
                                                    <span className="text-sm">Start Date</span>
                                                </div>
                                                <span className="text-white text-sm font-medium">
                                                    {format(new Date(schedule.start_date), 'MMM do, yyyy')}
                                                </span>
                                            </div>
                                        )}

                                        {/* Program Term - Always Show */}
                                        <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/5 border border-white/5">
                                            <div className="flex items-center text-zinc-400 gap-2.5">
                                                <CalendarIcon className="w-4 h-4" />
                                                <span className="text-sm">Program Term</span>
                                            </div>
                                            <span className="text-white text-sm font-medium">
                                                {getProgramTerm(schedule?.plan_name) || "Custom Term"}
                                            </span>
                                        </div>

                                        {/* Recurring Info */}
                                        {schedule?.payment_type === 'recurring' && schedule?.start_date && (
                                            <div className="bg-neon-green/5 border border-neon-green/10 rounded-xl p-3">
                                                <p className="text-xs text-neon-green/90 leading-relaxed">
                                                    <span className="font-semibold block mb-0.5">Billing Schedule</span>
                                                    Your first month is collected today. Recurring billing begins <strong>{format(addOneMonth(new Date(schedule.start_date)), 'MMM do')}</strong>.
                                                </p>
                                            </div>
                                        )}

                                        {/* Payment Type Badge */}
                                        <div className="pt-1">
                                            {schedule?.payment_type === 'recurring' ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-neon-green/10 text-neon-green border border-neon-green/20 uppercase tracking-wider">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse" />
                                                    Monthly Subscription
                                                </span>
                                            ) : schedule.isSplitPayment === 'true' || schedule.plan_name?.toLowerCase().includes('split') ? (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase tracking-wider">
                                                    Installment Plan
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-white/10 text-zinc-300 border border-white/10 uppercase tracking-wider">
                                                    One-Time Payment
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Future Payments Schedule (Split Only) */}
                                    {/* @ts-ignore - scheduled_charges join */}
                                    {schedule?.scheduled_charges && schedule.scheduled_charges.length > 0 && (
                                        <div className="pt-4 border-t border-white/5 space-y-3">
                                            <div className="flex items-center gap-2 text-zinc-400">
                                                <CalendarIcon className="w-3.5 h-3.5 text-neon-green" />
                                                <span className="text-xs uppercase tracking-wider font-medium text-neon-green">Future Payments</span>
                                            </div>
                                            <div className="space-y-2">
                                                {/* @ts-ignore - scheduled_charges type */}
                                                {schedule.scheduled_charges.map((charge: any, i: number) => (
                                                    <div key={charge.id} className="flex items-center justify-between text-sm p-2 rounded bg-white/5 border border-white/5">
                                                        <span className="text-zinc-400">Payment {i + 2}</span>
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-white font-medium">{formatCurrency(charge.amount, schedule.currency || 'usd')}</span>
                                                            <span className="text-[10px] text-zinc-500">Due {format(new Date(charge.due_date), 'MMM do, yyyy')}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex items-center gap-1.5 text-[10px] text-neon-green uppercase tracking-wider pt-3 border-t border-white/5 justify-center">
                                        <ShieldCheck className="w-3 h-3" />
                                        <span>Bank-Level 256-bit SSL Encryption</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT COLUMN: Stripe Checkout */}
                        <div className="lg:col-span-7 flex flex-col justify-start pt-2">
                            {clientSecret && (
                                <div className="relative">
                                    <div className="absolute -inset-1 bg-gradient-to-b from-zinc-800 to-transparent rounded-2xl blur-sm opacity-20"></div>
                                    <div className="bg-white rounded-2xl shadow-2xl shadow-black/80 overflow-hidden min-h-[550px] relative z-10 ring-1 ring-white/10">
                                        <EmbeddedCheckoutProvider
                                            stripe={stripePromise}
                                            options={{ clientSecret }}
                                        >
                                            <EmbeddedCheckout className="h-full w-full" />
                                        </EmbeddedCheckoutProvider>
                                    </div>
                                    <p className="text-center text-zinc-600 text-[10px] mt-4">
                                        By confirming your payment, you agree to our Terms of Service and Privacy Policy.
                                    </p>
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

function getPlanDescription(planName: string = '') {
    const lower = planName.toLowerCase()
    if (lower.includes('lifestyle')) {
        return "You are one step away from a healthier & more fit lifestyle."
    }
    if (lower.includes('competition') || lower.includes('prep')) {
        return "You are about to be one step closer to walking on stage."
    }
    if (lower.includes('nutrition')) {
        return "You are one step away from dialing in your nutrition, and living a better & healthier life for it."
    }
    return "You're one step away from transforming your lifestyle. Complete your enrollment below."
}

function getProgramTerm(planName: string = '') {
    // Try to extract term from name (e.g. "16 Week", "6 Month")
    const match = planName.match(/(\d+)\s*(?:Week|Month)s?/i)
    if (match) {
        return match[0] // e.g. "16 Week"
    }
    // Fallback based on keywords
    if (planName.toLowerCase().includes('year')) return '12 Months'
    return null
}
