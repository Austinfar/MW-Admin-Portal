'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { acceptInvitation } from '@/lib/actions/invitations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CardContent, CardFooter } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface JoinFormProps {
    token: string;
    email: string;
}

export function JoinForm({ token, email }: JoinFormProps) {
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    async function handleSubmit(formData: FormData) {
        setIsLoading(true);

        const password = formData.get('password') as string;
        const confirmPassword = formData.get('confirmPassword') as string;

        if (password !== confirmPassword) {
            toast.error("Passwords do not match");
            setIsLoading(false);
            return;
        }

        if (password.length < 6) {
            toast.error("Password must be at least 6 characters");
            setIsLoading(false);
            return;
        }

        const res = await acceptInvitation(token, formData);

        setIsLoading(false);

        if (res.error) {
            toast.error(res.error);
        } else {
            toast.success("Account activated successfully!");
            router.push('/login?joined=true');
        }
    }

    return (
        <form action={handleSubmit}>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="email" className="text-gray-400">Email Address (Locked)</Label>
                    <Input
                        id="email"
                        type="email"
                        value={email}
                        disabled
                        className="bg-[#111]/50 border-white/10 text-gray-400 cursor-not-allowed"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="password" className="text-white">Create Password</Label>
                    <Input
                        id="password"
                        name="password"
                        type="password"
                        placeholder="••••••••"
                        required
                        className="bg-[#111] border-white/10 text-white focus:ring-green-600 focus:border-green-600 transition-colors"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-white">Confirm Password</Label>
                    <Input
                        id="confirmPassword"
                        name="confirmPassword"
                        type="password"
                        placeholder="••••••••"
                        required
                        className="bg-[#111] border-white/10 text-white focus:ring-green-600 focus:border-green-600 transition-colors"
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
                            Activating Account...
                        </>
                    ) : (
                        'Activate Account'
                    )}
                </Button>
            </CardFooter>
        </form>
    );
}
