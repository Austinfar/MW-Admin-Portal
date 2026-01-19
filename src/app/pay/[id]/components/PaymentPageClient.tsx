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

export default function PaymentPageClient({ id }: { id: string }) {
    const [clientSecret, setClientSecret] = useState<string | null>(null)
    const [schedule, setSchedule] = useState<any | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    const fetchSession = useCallback(async () => {
        setIsLoading(true)
        try {
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
            const sessionResult = await createCheckoutSessionForSchedule(id)

            if (sessionResult.error || !sessionResult.clientSecret) {
                setError(sessionResult.error || "Failed to initialize secure checkout.")
                setIsLoading(false)
                return
            }

            setClientSecret(sessionResult.clientSecret)

        } catch (err: any) {
            console.error(err)
            setError(err.message || "An unexpected error occurred.")
        } finally {
            setIsLoading(false)
        }
    }, [id])

    useEffect(() => {
        fetchSession()
    }, [fetchSession])

    // --- Helper Functions ---
    const formatCurrency = (amount: number, currency = 'usd') => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency,
        }).format(amount / 100)
    }

    const addOneMonth = (dateStr: string) => {
        if (!dateStr) return 'N/A'
        try {
            const date = new Date(dateStr)
            date.setMonth(date.getMonth() + 1)
            return format(date, 'MMMM do, yyyy')
        } catch (e) {
            return 'Date Error'
        }
    }

    const getPlanDescription = (planName: string) => {
        if (planName.toLowerCase().includes('lifestyle')) return 'Standard Coaching Plan'
        if (planName.toLowerCase().includes('premium')) return 'Premium Coaching Plan'
        if (planName.toLowerCase() === 'custom plan') return 'Specialized Program'
        return 'Coaching Program'
    }

    const getProgramTerm = (planName: string | undefined): string | null => {
        if (!planName) return null;
        const match = planName.match(/(\d+)\s*Months?/i); // Matches "6 Months", "12 Month"
        return match ? `${match[1]} Months` : null;
    }


    // --- Render Loading State ---
    if (isLoading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-black">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-10 w-10 animate-spin text-white" />
                    <p className="text-sm text-zinc-400">Loading secure checkout...</p>
                </div>
            </div>
        )
    }

    // --- Render Error State ---
    if (error) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-black p-4">
                <div className="max-w-md w-full bg-zinc-900 border border-red-900/50 rounded-xl p-8 text-center space-y-4">
                    <div className="h-12 w-12 bg-red-900/20 rounded-full flex items-center justify-center mx-auto">
                        <ShieldCheck className="h-6 w-6 text-red-500" />
                    </div>
                    <h2 className="text-xl font-semibold text-white">Unable to Load Checkout</h2>
                    <p className="text-sm text-zinc-400">{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-4 px-4 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-zinc-200 transition-colors"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        )
    }

    // --- Render Payment Page ---
    return (
        <div className="min-h-screen bg-black text-white relative">

            {/* FIXED HEADER - Always visible */}
            <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center py-2 bg-black/80 backdrop-blur-md border-b border-white/5">
                <div className="flex items-center gap-2 text-green-500">
                    <ShieldCheck className="w-4 h-4" />
                    <span className="text-xs font-semibold uppercase tracking-wider">Secure Payment via Stripe</span>
                </div>
            </div>

            {/* Main Content - Add top margin to clear fixed header */}
            <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 mt-8">

                {/* Secure Checkout Header */}
                <div className="mb-8 lg:mb-12 text-center lg:text-left">
                    <p className="text-sm text-zinc-500 font-medium mb-2 uppercase tracking-wider">Complete Your Enrollment</p>
                </div>


                {clientSecret && (
                    <EmbeddedCheckoutProvider
                        stripe={stripePromise}
                        options={{ clientSecret }}
                    >
                        {!!schedule && (
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
                                {/* LEFT COLUMN: Brand & Order Context */}
                                <div className="lg:col-span-5 space-y-8 lg:sticky lg:top-28 h-fit">

                                    {/* Brand Logo */}
                                    <div className="relative w-40 h-auto">
                                        <Image
                                            src="/logo-white.svg"
                                            alt="MW Fitness"
                                            width={160}
                                            height={60}
                                            className="object-contain"
                                            priority
                                        />
                                    </div>

                                    <div>
                                        <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-white mb-4">
                                            {schedule.plan_name}
                                        </h1>
                                        <p className="text-zinc-400 leading-relaxed text-sm lg:text-base">
                                            You are one step away from finalizing your enrollment.
                                            Review your program details below and proceed to secure payment.
                                        </p>
                                    </div>

                                    {/* Order Summary Card */}
                                    <div className="bg-zinc-900/50 backdrop-blur-sm border border-white/10 rounded-2xl p-6 shadow-xl">
                                        <h3 className="text-lg font-semibold text-white mb-4 border-b border-white/5 pb-4">
                                            Order Summary
                                        </h3>

                                        <div className="space-y-4">
                                            {/* Coach - If Assigned */}
                                            {schedule.assigned_coach_id && (
                                                <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/5 border border-white/5">
                                                    <div className="flex items-center text-zinc-400 gap-2.5">
                                                        <UserCircle className="w-4 h-4" />
                                                        <span className="text-sm">Head Coach</span>
                                                    </div>
                                                    <div className="flex items-center text-white text-sm font-medium gap-2">
                                                        {schedule.coach_name || 'Assigned Coach'} {/* Requires join on users table in fetch */}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Program Term - Always Show */}
                                            <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/5 border border-white/5">
                                                <div className="flex items-center text-zinc-400 gap-2.5">
                                                    <CalendarIcon className="w-4 h-4" />
                                                    <span className="text-sm">Program Term</span>
                                                </div>
                                                <span className="text-white text-sm font-medium">
                                                    {schedule?.program_term ? `${schedule.program_term} Months` : (getProgramTerm(schedule?.plan_name) || "Custom Term")}
                                                </span>
                                            </div>

                                            {/* Total Value */}
                                            <div className="flex items-center justify-between pt-2">
                                                <span className="text-zinc-400 text-sm">Total Program Value</span>
                                                {/* Calculate total if split, or unit_amount if one-time */}
                                                <span className="text-white font-mono font-medium">
                                                    {formatCurrency(
                                                        schedule.payment_type === 'split'
                                                            ? (schedule.scheduled_charges?.reduce((acc: any, c: any) => acc + c.amount, 0) + schedule.amount)
                                                            : (schedule.amount || 0)
                                                    )}
                                                </span>
                                            </div>

                                            {/* Due Today Highlight */}
                                            <div className="mt-4 p-4 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center justify-between">
                                                <span className="text-green-400 font-semibold text-sm uppercase tracking-wide">Due Today</span>
                                                <span className="text-white font-bold text-xl">
                                                    {formatCurrency(schedule.amount)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* RIGHT COLUMN: Stripe Embedded Checkout */}
                                <div className="lg:col-span-7">
                                    <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-white/10 min-h-[600px]">
                                        <EmbeddedCheckout />
                                    </div>
                                    <div className="mt-6 text-center text-xs text-zinc-500 flex items-center justify-center gap-2">
                                        <ShieldCheck className="w-3 h-3" />
                                        <span>Payments are secure and encrypted.</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </EmbeddedCheckoutProvider>
                )}
            </div>
        </div>
    )
}
