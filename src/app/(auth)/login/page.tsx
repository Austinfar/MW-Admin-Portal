'use client'

import { login, signup } from './actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { useState } from 'react'

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
            toast.success('Logged in successfully') // Might not see this due to redirect
        }
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
            <Card className="w-full max-w-md">
                <CardHeader className="space-y-1">
                    <CardTitle className="text-2xl font-bold text-center">MW Fitness Coaching</CardTitle>
                    <CardDescription className="text-center">
                        {isSignUp ? 'Create an account to get started' : 'Enter your email and password to access the dashboard'}
                    </CardDescription>
                </CardHeader>
                <form action={handleSubmit}>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" name="email" type="email" placeholder="coach@example.com" required disabled={isLoading} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <Input id="password" name="password" type="password" required disabled={isLoading} />
                        </div>
                    </CardContent>
                    <CardFooter className="flex flex-col space-y-2">
                        <Button className="w-full" type="submit" disabled={isLoading}>
                            {isLoading ? (isSignUp ? 'Signing Up...' : 'Signing In...') : (isSignUp ? 'Sign Up' : 'Sign In')}
                        </Button>
                        <Button
                            variant="ghost"
                            className="w-full"
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
    )
}
