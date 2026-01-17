import { redirect } from 'next/navigation';
import { getInvitationByToken, acceptInvitation } from '@/lib/actions/invitations';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MWBackground } from '@/components/auth/MWBackground';
import { JoinForm } from './JoinForm';
import { toast } from 'sonner';

export default async function JoinPage({
    searchParams,
}: {
    searchParams: Promise<{ token?: string }>;
}) {
    // Await params in Next.js 15
    const { token } = await searchParams;

    if (!token) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-black text-white">
                <p>Invalid invitation link.</p>
            </div>
        );
    }

    const { invitation, error } = await getInvitationByToken(token);

    if (error || !invitation) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-black text-white">
                <Card className="w-full max-w-md bg-[#121212] border-white/10">
                    <CardHeader>
                        <CardTitle className="text-red-500">Invalid Invitation</CardTitle>
                        <CardDescription>{error || 'This invitation is invalid or has expired.'}</CardDescription>
                    </CardHeader>
                </Card>
            </div>
        );
    }

    async function handleAccept(formData: FormData) {
        'use server';
        const res = await acceptInvitation(token as string, formData);
        if (res.error) {
            // Since this is a server action called from a server component form, 
            // we can't easily toast unless we use a client component wrapper.
            // For MVP simplicity, we can redirect to login with error param or 
            // construct a client component form.
            // Given the requirement for high quality, let's use a client component form wrapper 
            // but for now, let's define the action logic here and realize we need a client component.
            console.error(res.error);
            // We should throw or redirect to error page? 
            // Actually, best practice is to make this page a client component or use a client form.
        } else {
            redirect('/login?joined=true'); // Redirect to login after success
        }
    }

    return (
        <div className="relative flex items-center justify-center min-h-screen bg-black overflow-hidden selection:bg-green-500/30">
            <MWBackground />

            <div className="z-10 w-full max-w-md px-4">
                <Card className="w-full bg-[#121212]/50 backdrop-blur-md border-white/10 shadow-2xl">
                    <CardHeader className="space-y-2 pb-6">
                        <div className="h-12 w-12 bg-green-600 rounded mx-auto flex items-center justify-center mb-2 shadow-lg shadow-green-900/20">
                            <span className="font-bold text-black text-xl tracking-tighter">MW</span>
                        </div>
                        <CardTitle className="text-2xl font-bold text-center text-white tracking-tight">Join the Team</CardTitle>
                        <CardDescription className="text-center text-gray-400">
                            Welcome, <span className="text-white font-medium">{invitation.email}</span>. <br />
                            Set your password to activate your account.
                        </CardDescription>
                    </CardHeader>
                    {/* We need a Client Component for the form to handle toast/loading interactions nicely */}
                    {/* But to save time/files, we can use a server component with a simple form action 
                        if we accept basic error handling (e.g. redirect back with error).
                        
                        However, `sonner` toasts won't work from server action response on server component.
                        Let's verify if I should make `JoinForm` client component. 
                        Yes, for "Premium Design" and "Smooth interactions", I MUST use a client component.
                    */}
                    <JoinForm token={token} email={invitation.email} />
                </Card>
            </div>
        </div>
    );
}

// Client Component for the form

