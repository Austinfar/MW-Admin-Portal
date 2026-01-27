'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { useState } from 'react'
import { MWBackground } from '@/components/auth/MWBackground'
import { Loader2, ArrowLeft } from 'lucide-react'
import { resetPassword } from './actions'

export default function ForgotPasswordPage() {
    const [isLoading, setIsLoading] = useState(false)
    const [isSuccess, setIsSuccess] = useState(false)

    async function handleSubmit(formData: FormData) {
        setIsLoading(true)
        const result = await resetPassword(formData)
        setIsLoading(false)

        if (result && 'error' in result) {
            toast.error(result.error)
        } else if (result?.success) {
            toast.success(result.success)
            setIsSuccess(true)
        }
    }

    return (
        <div className="relative flex items-center justify-center min-h-screen bg-black overflow-hidden selection:bg-green-500/30">
            {/* Vector Background */}
            <MWBackground />

            <div className="z-10 w-full max-w-md px-4">
                <Card className="w-full bg-[#121212]/50 backdrop-blur-md border-white/10 shadow-2xl">
                    <CardHeader className="space-y-2 pb-6">
                        {/* Logo */}
                        <div className="flex justify-center mb-2">
                            <Image
                                src="/logo-white.svg"
                                alt="MW Fitness Coaching"
                                width={240}
                                height={80}
                                className="object-contain"
                                priority
                            />
                        </div>
                        <CardDescription className="text-center text-gray-400">
                            Enter your email to receive a password reset link
                        </CardDescription>
                    </CardHeader>
                    {!isSuccess ? (
                        <form action={handleSubmit}>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="email" className="text-gray-300">Email</Label>
                                    <Input
                                        id="email"
                                        name="email"
                                        type="email"
                                        placeholder="coach@example.com"
                                        required
                                        disabled={isLoading}
                                        className="bg-[#1A1A1A] border-gray-800 text-white placeholder:text-gray-600 focus:border-green-500 focus:ring-green-500/20"
                                    />
                                </div>
                            </CardContent>
                            <CardFooter className="flex flex-col space-y-3 pt-2">
                                <Button
                                    className="w-full bg-green-600 hover:bg-green-700 text-black font-bold transition-all duration-200 shadow-lg shadow-green-900/20"
                                    type="submit"
                                    disabled={isLoading}
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin text-black" />
                                            Sending Link...
                                        </>
                                    ) : (
                                        'Reset Password'
                                    )}
                                </Button>
                                <Button
                                    variant="link"
                                    className="text-gray-400 hover:text-white"
                                    asChild
                                >
                                    <Link href="/login" className="flex items-center gap-2">
                                        <ArrowLeft className="h-4 w-4" />
                                        Back to Login
                                    </Link>
                                </Button>
                            </CardFooter>
                        </form>
                    ) : (
                        <CardContent className="space-y-4 pt-4">
                            <div className="text-center text-green-400 bg-green-900/20 p-4 rounded-lg border border-green-900/50">
                                <p className="font-medium">Check your email</p>
                                <p className="text-sm text-gray-400 mt-2">
                                    We've sent you a password reset link. Please check your inbox and spam folder.
                                </p>
                            </div>
                            <Button
                                variant="outline"
                                className="w-full border-gray-700 text-gray-300 hover:bg-[#1A1A1A] hover:text-white"
                                asChild
                            >
                                <Link href="/login">
                                    Return to Login
                                </Link>
                            </Button>
                        </CardContent>
                    )}
                </Card>
            </div>
        </div>
    )
}
