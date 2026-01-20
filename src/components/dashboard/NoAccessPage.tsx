'use client'

import { useEffect, useRef } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface NoAccessPageProps {
    userName?: string
}

export function NoAccessPage({ userName }: NoAccessPageProps) {
    const displayName = userName || 'friend'
    const audioRef = useRef<HTMLAudioElement>(null)

    useEffect(() => {
        const audio = audioRef.current
        if (!audio) return

        // Start at 1:24 (84 seconds)
        audio.currentTime = 84

        // Play the audio
        audio.play().catch(err => {
            // Browser might block autoplay, that's okay
            console.log('Audio autoplay blocked:', err)
        })

        // Stop at 1:30 (90 seconds)
        const handleTimeUpdate = () => {
            if (audio.currentTime >= 90) {
                audio.pause()
            }
        }

        audio.addEventListener('timeupdate', handleTimeUpdate)

        return () => {
            audio.removeEventListener('timeupdate', handleTimeUpdate)
            audio.pause()
        }
    }, [])

    return (
        <div className="flex flex-col items-center justify-center min-h-[80vh] p-8">
            {/* Hidden audio element */}
            <audio
                ref={audioRef}
                src="/The Lord of the Rings - You Shall Not Pass - (HD) - TheLotrTV (youtube).mp3"
                preload="auto"
            />

            <Card className="max-w-lg w-full bg-card/40 border-destructive/20">
                <CardHeader className="text-center pb-2">
                    <div className="mx-auto mb-4 p-4 rounded-full bg-destructive/10">
                        <AlertTriangle className="h-12 w-12 text-destructive" />
                    </div>
                    <CardTitle className="text-2xl">
                        Damn, {displayName}!
                    </CardTitle>
                </CardHeader>
                <CardContent className="text-center space-y-4">
                    <p className="text-muted-foreground text-lg">
                        It looks like someone really doesn't like you, or trust you to access the systems.
                    </p>
                    <p className="text-sm text-muted-foreground/80 italic">
                        (Blame Sarah)
                    </p>
                    <div className="pt-4 border-t border-border/50 mt-6">
                        <p className="text-xs text-muted-foreground">
                            If you believe this is an error, please contact your administrator.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

