'use client';

import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { createUser } from '@/lib/actions/profile';
import { toast } from 'sonner';
import { Loader2, UserPlus } from 'lucide-react';

const JOB_TITLE_OPTIONS = [
    { value: 'coach', label: 'Coach' },
    { value: 'head_coach', label: 'Head Coach' },
    { value: 'closer', label: 'Closer' },
    { value: 'admin_staff', label: 'Admin Staff' },
    { value: 'operations', label: 'Operations' },
];

const ROLE_OPTIONS = [
    { value: 'user', label: 'Standard User' },
    { value: 'admin', label: 'Admin' },
];

interface CreateUserDialogProps {
    onSuccess?: () => void;
    isSuperAdmin: boolean;
}

export function CreateUserDialog({ onSuccess, isSuperAdmin }: CreateUserDialogProps) {
    const [open, setOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Form State
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<'admin' | 'user'>('user');
    const [jobTitle, setJobTitle] = useState('coach');

    const resetForm = () => {
        setName('');
        setEmail('');
        setPassword('');
        setRole('user');
        setJobTitle('coach');
    };

    const handleSubmit = async () => {
        if (!name.trim() || !email.trim() || !password.trim()) {
            toast.error('Please fill in all required fields');
            return;
        }

        if (password.length < 6) {
            toast.error('Password must be at least 6 characters');
            return;
        }

        setIsLoading(true);
        try {
            const result = await createUser({
                name: name.trim(),
                email: email.trim().toLowerCase(),
                password,
                role,
                jobTitle,
            });

            if (result.error) {
                toast.error(result.error);
                return;
            }

            toast.success('User created successfully');
            resetForm();
            setOpen(false);
            if (onSuccess) onSuccess();
        } catch (error) {
            toast.error('Failed to create user');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => {
            setOpen(isOpen);
            if (!isOpen) resetForm();
        }}>
            <DialogTrigger asChild>
                <Button>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Create User
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-[#1a1a1a] border-white/10 text-white">
                <DialogHeader>
                    <DialogTitle>Create New User</DialogTitle>
                    <DialogDescription>
                        Create a new team member with immediate access. No invitation required.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Name */}
                    <div className="space-y-2">
                        <Label htmlFor="name">Full Name *</Label>
                        <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="John Doe"
                            className="bg-white/5 border-white/10"
                        />
                    </div>

                    {/* Email */}
                    <div className="space-y-2">
                        <Label htmlFor="email">Email *</Label>
                        <Input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="john@example.com"
                            className="bg-white/5 border-white/10"
                        />
                    </div>

                    {/* Password */}
                    <div className="space-y-2">
                        <Label htmlFor="password">Password *</Label>
                        <Input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Min 6 characters"
                            className="bg-white/5 border-white/10"
                        />
                    </div>

                    {/* Role */}
                    <div className="space-y-2">
                        <Label htmlFor="role">Access Level</Label>
                        <Select value={role} onValueChange={(val) => setRole(val as 'admin' | 'user')}>
                            <SelectTrigger className="bg-white/5 border-white/10">
                                <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                            <SelectContent>
                                {ROLE_OPTIONS.filter(opt => isSuperAdmin || opt.value !== 'admin').map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {!isSuperAdmin && (
                            <p className="text-[10px] text-muted-foreground">Only Super Admins can create other Admins.</p>
                        )}
                    </div>

                    {/* Job Title */}
                    <div className="space-y-2">
                        <Label htmlFor="jobTitle">Job Type</Label>
                        <Select value={jobTitle} onValueChange={setJobTitle}>
                            <SelectTrigger className="bg-white/5 border-white/10">
                                <SelectValue placeholder="Select job type" />
                            </SelectTrigger>
                            <SelectContent>
                                {JOB_TITLE_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={() => setOpen(false)} disabled={isLoading}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={isLoading}>
                        {isLoading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Creating...
                            </>
                        ) : (
                            'Create User'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
