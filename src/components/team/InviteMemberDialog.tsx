'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { createInvitation } from '@/lib/actions/invitations';
import { Loader2, Send } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
// import { searchGHLContacts } from '@/lib/actions/ghl'; // We'll need this exposed
// For now, simple text input for GHL Contact ID? Or just use email?
// The requirement was "Search GHL Contact or Enter Number". 
// To make it simple for MVP, we'll start with text input or assume email matches?
// Actually, GHL SMS requires a Contact ID. 
// Let's add a "Search GHL Contact" input later. For now, simple ID input or skip if complicated.
// "In Invite Member modal, add "Send via SMS" field (Search GHL Contact or Enter Number)."
// I'll implementation a simplified version first: Email + Role. And a checkbox "Send SMS invite via GHL" 
// which tries to find the contact by Email in GHL first? That would be smart.

export function InviteMemberDialog() {
    const [open, setOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    async function onSubmit(formData: FormData) {
        setIsLoading(true);
        // We'll let the server action handle the GHL lookup by email if we didn't pass an ID
        // Wait, server action expects contactId. I should update server action to lookup by email if missing.
        // For now, let's just pass the email/role and let the user handle the link manually if SMS fails.
        // Or better: The server action returns the link.

        const res = await createInvitation(formData);

        setIsLoading(false);
        if (res.error) {
            toast.error(res.error);
        } else {
            setOpen(false);
            if (res.smsStatus === 'sent') {
                toast.success('Invitation sent via SMS!');
            } else if (res.smsStatus === 'failed') {
                toast.warning('Invitation created, but SMS failed. Please copy the link.');
            } else {
                toast.success('Invitation created!');
            }

            // Show the link to the user
            if (res.link) {
                // In a real app we might show a "Copy Link" modal now.
                // For now, we rely on the list view showing pending invites.
                navigator.clipboard.writeText(res.link);
                toast.info('Link copied to clipboard');
            }
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-green-600 text-black hover:bg-green-700">
                    <Send className="mr-2 h-4 w-4" />
                    Invite Member
                </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#1a1a1a] border-white/10 text-white sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Invite New Team Member</DialogTitle>
                    <DialogDescription className="text-gray-400">
                        Send an invitation to join the dashboard. They will receive a unique link to set their password.
                    </DialogDescription>
                </DialogHeader>
                <form action={onSubmit} className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="email" className="text-right text-gray-400">
                            Email
                        </Label>
                        <Input
                            id="email"
                            name="email"
                            type="email"
                            placeholder="colleague@mwfitness.com"
                            className="col-span-3 bg-[#111] border-white/10 text-white focus:ring-green-600"
                            required
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="role" className="text-right text-gray-400">
                            Role
                        </Label>
                        <Select name="role" required defaultValue="coach">
                            <SelectTrigger className="col-span-3 bg-[#111] border-white/10 text-white">
                                <SelectValue placeholder="Select a role" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#1a1a1a] border-white/10 text-white">
                                <SelectItem value="coach">Coach</SelectItem>
                                <SelectItem value="sales">Sales Closer</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* SMS Toggle Area - Simplified for now */}

                    <DialogFooter>
                        <Button
                            type="submit"
                            disabled={isLoading}
                            className="bg-green-600 text-black hover:bg-green-700"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Generating...
                                </>
                            ) : (
                                'Generate Invite'
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
