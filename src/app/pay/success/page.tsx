'use client'

import Image from 'next/image'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { MWBackground } from '@/components/auth/MWBackground'

export default function PaymentSuccessPage() {
    return (
        <div className="relative min-h-screen bg-black text-white flex flex-col items-center justify-center font-sans selection:bg-green-500/30 overflow-hidden">
            {/* Background */}
            <MWBackground />

            {/* Header / Logo */}
            <div className="absolute top-0 left-0 w-full p-6 flex justify-center z-10">
                <Image
                    src="/logo-white.svg"
                    alt="MW Fitness"
                    width={180}
                    height={50}
                    className="object-contain opacity-80"
                />
            </div>

            {/* Content Card */}
            <div className="z-10 w-full max-w-md px-6">
                <div className="bg-[#111]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-8 text-center shadow-2xl space-y-6 animate-in fade-in zoom-in duration-500">

                    {/* Icon */}
                    <div className="flex justify-center">
                        <div className="h-20 w-20 bg-green-500/10 rounded-full flex items-center justify-center border border-green-500/20 shadow-[0_0_30px_rgba(34,197,94,0.2)]">
                            <CheckCircle2 className="h-10 w-10 text-green-500" />
                        </div>
                    </div>

                    {/* Text */}
                    <div className="space-y-2">
                        <h1 className="text-3xl font-bold text-white tracking-tight">Payment Successful</h1>
                        <p className="text-gray-400 text-sm leading-relaxed">
                            Thank you for your payment. Your transaction has been securely processed and your coach has been notified.
                        </p>
                    </div>

                    {/* Receipt Info (Static for now, could catch query params later) */}
                    <div className="py-4 border-t border-white/5 border-b border-white/5">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Status</span>
                            <span className="text-green-400 font-medium">Confirmed</span>
                        </div>
                    </div>

                    {/* Action */}
                    <div className="pt-2">
                        <Button
                            asChild
                            className="w-full bg-white text-black hover:bg-gray-200 font-bold h-11 transition-all"
                        >
                            <Link href="https://mwfitnesscoaching.com">
                                Return to Homepage
                            </Link>
                        </Button>
                    </div>
                </div>

                <div className="mt-8 text-center space-y-2">
                    <p className="text-[10px] text-gray-600 uppercase tracking-widest">Powered by MW Fitness</p>
                </div>
            </div>
        </div>
    )
}
