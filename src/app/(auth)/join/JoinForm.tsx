'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { acceptInvitation } from '@/lib/actions/invitations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CardContent, CardFooter } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Eye, EyeOff, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils'; // Assuming standard shadcn utils exist

interface JoinFormProps {
    token: string;
    email: string;
}

export function JoinForm({ token, email }: JoinFormProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // Password requirements state
    const [requirements, setRequirements] = useState({
        length: false,
        uppercase: false,
        lowercase: false,
        number: false,
        special: false
    });

    const router = useRouter();

    // Force signout on mount to ensure clean session for new user
    useEffect(() => {
        const signOut = async () => {
            const { createBrowserClient } = await import('@supabase/ssr');
            const supabase = createBrowserClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
            );
            await supabase.auth.signOut();
        };
        signOut();
    }, []);

    useEffect(() => {
        setRequirements({
            length: password.length >= 12,
            uppercase: /[A-Z]/.test(password),
            lowercase: /[a-z]/.test(password),
            number: /[0-9]/.test(password),
            special: /[^A-Za-z0-9]/.test(password)
        });
    }, [password]);

    const isPasswordValid = Object.values(requirements).every(Boolean);
    const doPasswordsMatch = password === confirmPassword && password.length > 0;

    async function handleSubmit(formData: FormData) {
        // Prevent submission if invalid (though button should be disabled)
        if (!isPasswordValid || !doPasswordsMatch) {
            toast.error("Please meet all password requirements.");
            return;
        }

        setIsLoading(true);

        // Use the state values to ensure we send what was validated
        // But formData is what the action expects... let's update formData or just append?
        // Actually, the server action reads from formData. 
        // We can just rely on the inputs having `name="password"` and `name="confirmPassword"`
        // The controlled inputs still emit their value to the form.

        const res = await acceptInvitation(token, formData);

        setIsLoading(false);

        if (res.error) {
            toast.error(res.error);
        } else {
            toast.success("Account activated successfully!");
            router.push('/login?joined=true');
        }
    }

    // Calculate strength score (0-5)
    const strengthScore = Object.values(requirements).filter(Boolean).length;

    // Determine strength color and label
    const getStrengthInfo = () => {
        if (password.length === 0) return { label: '', color: 'bg-gray-700', width: '0%' };
        if (strengthScore <= 2) return { label: 'Weak', color: 'bg-red-500', width: '33%' };
        if (strengthScore <= 4) return { label: 'Fair', color: 'bg-yellow-500', width: '66%' };
        return { label: 'Strong', color: 'bg-green-500', width: '100%' };
    };

    const strength = getStrengthInfo();

    return (
        <form action={handleSubmit}>
            <CardContent className="space-y-5">
                {/* Email Field */}
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

                {/* Password Field */}
                <div className="space-y-2">
                    <Label htmlFor="password" className="text-white">Create Password</Label>
                    <div className="relative">
                        <Input
                            id="password"
                            name="password"
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••••••"
                            required
                            className="bg-[#111] border-white/10 text-white focus:ring-green-600 focus:border-green-600 transition-colors pr-10"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                        >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>

                    {/* Strength Meter */}
                    <div className="h-1 w-full bg-gray-800 rounded-full mt-2 overflow-hidden">
                        <div
                            className={`h-full transition-all duration-300 ${strength.color}`}
                            style={{ width: strength.width }}
                        />
                    </div>
                </div>

                {/* Requirements Checklist */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <RequirementItem met={requirements.length} text="12+ Characters" />
                    <RequirementItem met={requirements.uppercase} text="Uppercase Letter" />
                    <RequirementItem met={requirements.lowercase} text="Lowercase Letter" />
                    <RequirementItem met={requirements.number} text="Number" />
                    <RequirementItem met={requirements.special} text="Special Character" />
                </div>

                {/* Confirm Password */}
                <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-white">Confirm Password</Label>
                    <Input
                        id="confirmPassword"
                        name="confirmPassword"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••••••"
                        required
                        className={cn(
                            "bg-[#111] border-white/10 text-white focus:ring-green-600 focus:border-green-600 transition-colors",
                            // Visual cue if passwords match
                            confirmPassword && (doPasswordsMatch ? "border-green-500/50" : "border-red-500/50")
                        )}
                    />
                </div>
            </CardContent>

            <CardFooter className="flex flex-col space-y-3 pt-2">
                <Button
                    className="w-full bg-green-600 hover:bg-green-700 text-black font-bold transition-all duration-200 shadow-lg shadow-green-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    type="submit"
                    disabled={isLoading || !isPasswordValid || !doPasswordsMatch}
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

function RequirementItem({ met, text }: { met: boolean; text: string }) {
    return (
        <div className={cn("flex items-center space-x-2 transition-colors", met ? "text-green-500" : "text-gray-500")}>
            {met ? <Check size={12} /> : <X size={12} />}
            <span>{text}</span>
        </div>
    );
}
