
'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'

interface EasterEggProps {
    isActive: boolean
    onComplete: () => void
}

export function EasterEgg({ isActive, onComplete }: EasterEggProps) {
    const audioRef = useRef<HTMLAudioElement>(null)

    useEffect(() => {
        if (isActive) {
            // Play audio with retry
            const playAudio = async () => {
                if (audioRef.current) {
                    try {
                        audioRef.current.volume = 1.0 // Bump volume
                        audioRef.current.currentTime = 26 // Start at 26s
                        await audioRef.current.play()
                    } catch (e) {
                        console.error('Audio autoplay failed:', e)
                    }
                }
            }
            playAudio()

            // Auto dismiss after 11 seconds
            const timer = setTimeout(() => {
                onComplete()
            }, 11000)

            return () => clearTimeout(timer)
        } else {
            if (audioRef.current) {
                audioRef.current.pause()
                audioRef.current.currentTime = 0
            }
        }
    }, [isActive, onComplete])

    if (!isActive) return null

    return (
        <div className="fixed inset-0 z-[100] pointer-events-none flex items-end justify-center overflow-hidden">
            {/* Audio Element */}
            <audio ref={audioRef} src="/money-trees.mp3" preload="auto" />

            {/* Overlay / Party Mode Background Effect - Black tint to make image pop */}
            <div className="absolute inset-0 bg-black/40 animate-pulse z-0" />

            {/* Rising Image */}
            <div className="relative z-20 animate-rise-and-bounce mb-[-50px]">
                <Image
                    src="/matt-money.png?v=2"
                    alt="Money Trees"
                    width={700}
                    height={300}
                    priority
                    unoptimized // Force bypass Next.js optimization to ensure new file is loaded
                    className="object-contain max-h-[100vh] w-auto drop-shadow-[0_0_50px_rgba(34,197,94,0.6)]"
                />
            </div>

            {/* Flying Cash / Confetti */}
            <div className="absolute inset-0 overflow-hidden z-30">
                {[...Array(25)].map((_, i) => (
                    <div
                        key={i}
                        className="absolute text-5xl animate-fall"
                        style={{
                            left: `${Math.random() * 100}%`,
                            top: '-100px', // Start above screen
                            animationDelay: `${Math.random() * 2}s`, // Start sooner
                            animationDuration: `${3 + Math.random() * 3}s`
                        }}
                    >
                        💸
                    </div>
                ))}
            </div>

            <style jsx>{`
                @keyframes rise-and-bounce {
                    0% { transform: translateY(90%); } /* Start with distinct top visible */
                    30% { transform: translateY(0); } /* Slowly rise to full height over 3s */
                    45% { transform: translateY(20px); } /* Bounce down */
                    60% { transform: translateY(0); } /* Back up */
                    100% { transform: translateY(0); } /* Stay */
                }
                .animate-rise-and-bounce {
                    animation: rise-and-bounce 11s ease-out forwards;
                }
                @keyframes fall {
                    0% { transform: translateY(0) rotate(0deg); opacity: 0; }
                    10% { opacity: 1; }
                    100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
                }
                .animate-fall {
                    animation: fall linear infinite;
                }
            `}</style>
        </div>
    )
}
