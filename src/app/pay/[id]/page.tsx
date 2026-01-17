'use client'

import Image from 'next/image'
import { useEffect, useState, use } from 'react'
// ...

// ... inside JSX ...
<div className="w-full border-b border-white/10 bg-black/50 backdrop-blur-md sticky top-0 z-10 hidden md:block">
    <div className="max-w-6xl mx-auto px-6 h-16 flex items-center">
        <div className="flex items-center gap-2">
            <Image
                src="/logo-glow.svg"
                alt="MW Fitness"
                width={150}
                height={40}
                className="object-contain"
            />
        </div>
    </div>
</div>
import { loadStripe } from '@stripe/stripe-js'
import {
    EmbeddedCheckoutProvider,
    EmbeddedCheckout,
} from '@stripe/react-stripe-js'
import { getPaymentSchedule, createCheckoutSessionForSchedule } from '@/lib/actions/stripe-actions'
import { Loader2 } from 'lucide-react'

// Initialize Stripe outside component
// Make sure NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is set in .env.local
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

export default function PayPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const [clientSecret, setClientSecret] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [schedule, setSchedule] = useState<any>(null)

    useEffect(() => {
        async function init() {
            try {
                // 1. Fetch Schedule Details (Display only, optional security verify)
                const sched = await getPaymentSchedule(id)
                if (sched.error || !sched.data) {
                    setError('Invalid Payment Link')
                    setLoading(false)
                    return
                }
                setSchedule(sched.data)

                // 2. Create Stripe Session on the fly
                const session = await createCheckoutSessionForSchedule(id)
                if (session.error || !session.clientSecret) {
                    setError(session.error || 'Failed to initialize payment')
                    return
                }

                setClientSecret(session.clientSecret)
            } catch (err) {
                console.error(err)
                setError('Something went wrong')
            } finally {
                setLoading(false)
            }
        }

        init()
    }, [id])

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50">
                <Loader2 className="h-10 w-10 animate-spin text-gray-400" />
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex h-screen items-center justify-center bg-black text-white flex-col gap-4">
                <div className="text-xl font-semibold text-red-500">Error</div>
                <p className="text-gray-400">{error}</p>
            </div>
        )
    }

    // Default Stripe appearance (White) for reliability

    return (
        <div id="checkout" className="min-h-screen bg-black text-white flex flex-col font-sans selection:bg-green-500/30">
            {/* Header / Logo */}
            <div className="w-full border-b border-white/10 bg-black/50 backdrop-blur-md sticky top-0 z-10 hidden md:block">
                <div className="max-w-6xl mx-auto px-6 h-16 flex items-center">
                    <div className="flex items-center gap-2">
                        <Image
                            src="/logo-white.svg"
                            alt="MW Fitness"
                            width={150}
                            height={40}
                            className="object-contain"
                        />
                    </div>
                </div>
            </div>

            <div className="w-full max-w-6xl mx-auto p-6 md:py-8 flex-grow">

                {/* Main Grid Layout */}
                <div className="grid md:grid-cols-12 gap-8 items-start">

                    {/* Left Col: Order Summary & Schedule - STICKY */}
                    <div className="md:col-span-5 space-y-5 md:sticky md:top-24 md:self-start">

                        {/* Product Info (Scaled Down) */}
                        <div className="text-left space-y-2 mb-6">
                            <div className="inline-block px-2 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-[10px] font-bold tracking-wider uppercase mb-1">
                                Secure Checkout
                            </div>
                            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white leading-tight">
                                {schedule?.plan_name || 'Fitness Plan Assessment'}
                            </h1>
                            {schedule?.amount !== undefined && (
                                <div className="flex items-baseline gap-2 text-gray-400">
                                    <span className="text-sm">First Payment:</span>
                                    <span className="text-xl font-bold text-white">${(schedule.amount / 100).toLocaleString()}</span>
                                </div>
                            )}
                        </div>

                        {/* Future Schedule Card (Compacted) */}
                        {schedule?.scheduled_charges?.length > 0 && (
                            <div className="bg-[#111] rounded-xl border border-white/10 overflow-hidden max-w-sm">
                                <div className="px-4 py-3 border-b border-white/5 bg-white/5">
                                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                                        <svg className="w-3.5 h-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        Future Payments
                                    </h3>
                                </div>
                                <div className="divide-y divide-white/5 max-h-[250px] overflow-y-auto custom-scrollbar">
                                    {schedule.scheduled_charges.map((charge: any) => (
                                        <div key={charge.id} className="px-4 py-3 flex justify-between items-center hover:bg-white/5 transition-colors">
                                            <div className="flex flex-col">
                                                <span className="text-xs text-gray-300 font-medium">
                                                    {new Date(charge.due_date).toLocaleDateString(undefined, {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        year: 'numeric'
                                                    })}
                                                </span>
                                                <span className="text-[10px] text-gray-500">Auto-charge</span>
                                            </div>
                                            <div className="text-sm font-semibold text-white tracking-wide">
                                                ${(charge.amount / 100).toLocaleString()}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="px-4 py-2 bg-green-500/5 border-t border-green-500/10 text-[10px] text-green-400 text-center">
                                    ✓ Automated securely via Stripe
                                </div>
                            </div>
                        )}

                        {/* Secure Badge - Styled similar to Future Payments for consistency */}
                        {!schedule?.scheduled_charges?.length && (
                            <div className="bg-[#111] rounded-xl border border-white/10 p-4 text-center space-y-2 max-w-sm">
                                <div className="h-8 w-8 bg-white/5 rounded-full flex items-center justify-center mx-auto text-lg">🛡️</div>
                                <h3 className="text-white text-sm font-semibold">Secure Payment</h3>
                                <p className="text-[10px] text-gray-400">Encrypted and processed via Stripe.</p>
                            </div>
                        )}
                    </div>

                    {/* Right Col: Stripe Checkout */}
                    <div className="md:col-span-7">
                        {/* We use specific class to ensure iframe has clean white background */}
                        <div className="bg-white rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">
                            {clientSecret && (
                                <EmbeddedCheckoutProvider
                                    stripe={stripePromise}
                                    options={{ clientSecret }}
                                >
                                    <EmbeddedCheckout className="min-h-[500px]" />
                                </EmbeddedCheckoutProvider>
                            )}
                        </div>
                        <div className="mt-4 text-center md:text-right">
                            <p className="text-xs text-gray-600 opacity-50">Powered by Stripe</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
