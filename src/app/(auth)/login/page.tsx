'use client'

import { login, signup } from './actions'
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
    const [isSignUp, setIsSignUp] = useState(false)

    async function handleSubmit(formData: FormData) {
        setIsLoading(true)
        const action = isSignUp ? signup : login
        const result = await action(formData)
        setIsLoading(false)

        if (result && 'error' in result) {
            toast.error(result.error)
        } else if (result && 'success' in result) {
            toast.success(result.success)
        } else if (!isSignUp && !result) {
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
                        {/* Logo / Brand Mark could go here, for now just text */}
                        <div className="h-12 w-12 bg-green-600 rounded mx-auto flex items-center justify-center mb-2 shadow-lg shadow-green-900/20">
                            <span className="font-bold text-black text-xl tracking-tighter">MW</span>
                        </div>
                        <CardTitle className="text-2xl font-bold text-center text-white tracking-tight">MW Fitness Coaching</CardTitle>
                        <CardDescription className="text-center text-gray-400">
                            {isSignUp ? 'Join the elite coaching platform' : 'Access your dashboard'}
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
                                    {!isSignUp && (
                                        <button type="button" className="text-xs text-green-500 hover:text-green-400 font-medium tab-index-[-1]">
                                            Forgot password?
                                        </button>
                                    )}
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
                                        {isSignUp ? 'Creating account...' : 'Signing in...'}
                                    </>
                                ) : (
                                    isSignUp ? 'Sign Up' : 'Sign In'
                                )}
                            </Button>

                            <div className="relative w-full">
                                <div className="absolute inset-0 flex items-center">
                                    <span className="w-full border-t border-white/10" />
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-[#161616] px-2 text-gray-500">Or</span>
                                </div>
                            </div>

                            <Button
                                variant="ghost"
                                className="w-full text-gray-400 hover:text-white hover:bg-white/5"
                                type="button"
                                onClick={() => setIsSignUp(!isSignUp)}
                                disabled={isLoading}
                            >
                                {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
                            </Button>
                        </CardFooter>
                    </form>
                </Card>
            </div>
        </div>
    )
}
