'use client'

import React, { useEffect, useState, Suspense } from 'react'
import Image from 'next/image'
import { CheckCircle2, FileSignature, Calendar, Loader2 } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { retrieveCheckoutSession } from '@/lib/actions/stripe-actions'
import { format } from 'date-fns'
import { MWBackground } from '@/components/auth/MWBackground'

function SuccessContent() {
    const searchParams = useSearchParams()
    const sessionId = searchParams.get('session_id')

    const [status, setStatus] = useState<string | null>('loading')
    const [customerName, setCustomerName] = useState<string | null>(null)
    const [startDate, setStartDate] = useState<string | null>(null)

    useEffect(() => {
        if (!sessionId) {
            setStatus('error')
            return
        }

        const minLoadTime = new Promise(resolve => setTimeout(resolve, 2000))
        const sessionData = retrieveCheckoutSession(sessionId)

        Promise.all([sessionData, minLoadTime]).then(([data]) => {
            if (data.error) {
                setStatus('error')
            } else {
                setStatus('success')
                if (data.customer_details?.name) {
                    setCustomerName(data.customer_details.name)
                }
                if (data.metadata?.startDate && data.metadata.startDate !== 'Not Set') {
                    setStartDate(data.metadata.startDate)
                }
            }
        })
    }, [sessionId])

    if (status === 'loading') {
        return (
            <div className="flex flex-col items-center justify-center space-y-4 animate-pulse">
                <Loader2 className="w-10 h-10 text-neon-green animate-spin" />
                <p className="text-zinc-500 text-sm tracking-widest uppercase">Verifying Transaction...</p>
            </div>
        )
    }

    if (status === 'error') {
        return (
            <div className="text-center space-y-4">
                <p className="text-red-400 font-medium">Unable to load order details.</p>
                <div className="text-sm text-zinc-500">Please contact support if funds were deducted.</div>
            </div>
        )
    }

    const firstName = customerName ? customerName.split(' ')[0] : 'Athlete'

    return (
        <div className="z-10 w-full max-w-2xl px-6 animate-in fade-in slide-in-from-bottom-5 duration-700">
            {/* Main Success Card */}
            <div className="bg-[#111]/90 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 md:p-12 text-center shadow-2xl relative overflow-hidden group">

                {/* Glow Effect */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1 bg-gradient-to-r from-transparent via-neon-green to-transparent opacity-50 blur-[2px]" />

                {/* Success Icon */}
                <div className="flex justify-center mb-8 relative">
                    <div className="relative">
                        <div className="absolute inset-0 bg-neon-green/20 blur-xl rounded-full animate-pulse" />
                        <div className="h-24 w-24 bg-gradient-to-b from-zinc-800 to-black rounded-full flex items-center justify-center border border-neon-green/30 shadow-[0_0_30px_rgba(74,222,128,0.15)] relative z-10">
                            <CheckCircle2 className="h-12 w-12 text-neon-green drop-shadow-[0_0_10px_rgba(74,222,128,0.5)]" />
                        </div>
                    </div>
                </div>

                {/* Personal Welcome */}
                <div className="space-y-4 mb-12">
                    <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight">
                        Thank you, <span className="text-neon-green">{firstName}!</span>
                    </h1>
                    <p className="text-zinc-400 text-lg leading-relaxed max-w-lg mx-auto">
                        We're excited to have you join the MW Fitness Community.
                        {startDate && (
                            <span className="block mt-2 text-white font-medium">
                                Official Start Date: <span className="text-zinc-300">{format(new Date(startDate), 'MMMM do, yyyy')}</span>
                            </span>
                        )}
                    </p>
                </div>

                {/* Next Steps Timeline */}
                <div className="relative max-w-md mx-auto mb-4 text-left">
                    {/* Vertical Connecting Line */}
                    <div className="absolute left-[19px] top-8 bottom-8 w-[2px] bg-gradient-to-b from-neon-green/30 to-zinc-800" />

                    {/* Step 1 */}
                    <div className="relative flex items-start gap-6 mb-10">
                        <div className="relative z-10 w-10 h-10 rounded-full bg-black border border-neon-green/50 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(74,222,128,0.2)]">
                            <span className="font-mono font-bold text-neon-green">1</span>
                        </div>
                        <div className="pt-1">
                            <h3 className="text-neon-green text-lg font-medium mb-1 flex items-center gap-2">
                                Sign Agreement
                                <FileSignature className="w-4 h-4 text-neon-green" />
                            </h3>
                            <p className="text-sm text-zinc-400 leading-relaxed">
                                Check your email for the coaching agreement. Please sign it to finalize enrollment.
                            </p>
                        </div>
                    </div>

                    {/* Step 2 */}
                    <div className="relative flex items-start gap-6">
                        <div className="relative z-10 w-10 h-10 rounded-full bg-black border border-white/10 flex items-center justify-center shrink-0">
                            <span className="font-mono font-bold text-zinc-500">2</span>
                        </div>
                        <div className="pt-1">
                            <h3 className="text-white text-lg font-medium mb-1 flex items-center gap-2">
                                Kickoff Call
                                <Calendar className="w-4 h-4 text-zinc-500" />
                            </h3>
                            <p className="text-sm text-zinc-400 leading-relaxed">
                                Your coach will reach out shortly to schedule your initial onboarding strategy call.
                            </p>
                        </div>
                    </div>
                </div>

            </div>

            <div className="mt-8 text-center space-y-2">
                <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-medium">Powered by MW Fitness</p>
            </div>
        </div>
    )
}

export default function PaymentSuccessPage() {
    return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center font-sans selection:bg-neon-green/30 selection:text-neon-green relative overflow-hidden p-6">
            {/* Background */}
            <MWBackground />

            {/* Header / Logo */}
            <div className="relative z-20 mb-12">
                <Image
                    src="/logo-white.svg"
                    alt="MW Fitness"
                    width={180}
                    height={50}
                    className="object-contain opacity-80"
                    priority
                />
            </div>

            <Suspense fallback={
                <div className="flex flex-col items-center justify-center space-y-4 relative z-20">
                    <Loader2 className="w-10 h-10 text-neon-green animate-spin" />
                </div>
            }>
                <SuccessContent />
            </Suspense>
        </div>
    )
}
