'use client'

import Image from 'next/image'
import { login, signup } from './actions'
// ... existing imports ...

// ... inside component ...
<CardHeader className="space-y-2 pb-6">
    {/* Logo */}
    <div className="flex justify-center mb-2">
        <Image
            src="/logo-glow.svg"
            alt="MW Fitness Coaching"
            width={240}
            height={80}
            className="object-contain"
            priority
        />
    </div>
    <CardDescription className="text-center text-gray-400">
        Enter your credentials to access the dashboard
    </CardDescription>
</CardHeader>
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { useState } from 'react'
import { MWBackground } from '@/components/auth/MWBackground'
import { Loader2 } from 'lucide-react'

export default function LoginPage() {
    const [isLoading, setIsLoading] = useState(false)

    async function handleSubmit(formData: FormData) {
        setIsLoading(true)
        const result = await login(formData)
        setIsLoading(false)

        if (result && 'error' in result) {
            toast.error(result.error)
        } else if (!result) {
            // Login successful (redirect handled by action)
            toast.success('Logged in successfully')
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
                            Enter your credentials to access the dashboard
                        </CardDescription>
                    </CardHeader>
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
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="password" className="text-gray-300">Password</Label>
                                    <button type="button" className="text-xs text-green-500 hover:text-green-400 font-medium tab-index-[-1]">
                                        Forgot password?
                                    </button>
                                </div>
                                <Input
                                    id="password"
                                    name="password"
                                    type="password"
                                    required
                                    disabled={isLoading}
                                    className="bg-[#1A1A1A] border-gray-800 text-white focus:border-green-500 focus:ring-green-500/20"
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
                                        Signing in...
                                    </>
                                ) : (
                                    'Sign In'
                                )}
                            </Button>
                        </CardFooter>
                    </form>
                </Card>
            </div>
        </div>
    )
}
