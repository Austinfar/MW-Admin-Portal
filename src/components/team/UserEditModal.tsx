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
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { User, updateUserRole, updateUserCommissionConfig, updateUserJobTitle, updateUserDetails, deleteUser } from '@/lib/actions/profile';
import { toast } from 'sonner';
import { Loader2, Settings, Trash2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface UserEditModalProps {
    user: User;
    onUpdate?: () => void;
    isSuperAdmin?: boolean;
}

const JOB_TITLE_OPTIONS = [
    { value: 'coach', label: 'Coach' },
    { value: 'head_coach', label: 'Head Coach' },
    { value: 'closer', label: 'Closer' },
    { value: 'admin_staff', label: 'Admin Staff' },
    { value: 'operations', label: 'Operations' },
]

export function UserEditModal({ user, onUpdate, isSuperAdmin = false }: UserEditModalProps) {
    const [open, setOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // General Tab
    const [role, setRole] = useState(user.role);
    const [jobTitle, setJobTitle] = useState<string>(user.job_title || 'coach');

    // Account Tab (Super Admin only)
    const [name, setName] = useState(user.name || '');
    const [email, setEmail] = useState(user.email);
    const [newPassword, setNewPassword] = useState('');

    // Commission Tab
    const [commissionConfig, setCommissionConfig] = useState<Record<string, number>>({
        company_driven_rate: user.commission_config?.company_driven_rate || 0.30,
        self_gen_rate: user.commission_config?.self_gen_rate || 0.50
    });

    const handleSave = async () => {
        setIsLoading(true);
        try {
            // Update Role (if changed and not trying to make someone super_admin who isn't)
            if (role !== user.role) {
                const roleResult = await updateUserRole(user.id, role);
                if (roleResult.error) {
                    toast.error(roleResult.error);
                    setIsLoading(false);
                    return;
                }
            }

            // Update Job Title
            if (jobTitle !== user.job_title) {
                const jobTitleResult = await updateUserJobTitle(user.id, jobTitle);
                if (jobTitleResult.error) {
                    toast.error(jobTitleResult.error);
                    setIsLoading(false);
                    return;
                }
            }

            // Update Account Details (Super Admin only)
            if (isSuperAdmin) {
                const detailsToUpdate: { name?: string; email?: string; password?: string } = {};
                if (name !== user.name) detailsToUpdate.name = name;
                if (email !== user.email) detailsToUpdate.email = email;
                if (newPassword) detailsToUpdate.password = newPassword;

                if (Object.keys(detailsToUpdate).length > 0) {
                    const detailsResult = await updateUserDetails(user.id, detailsToUpdate);
                    if (detailsResult.error) {
                        toast.error(detailsResult.error);
                        setIsLoading(false);
                        return;
                    }
                }
            }

            // Update Commission Config
            const configResult = await updateUserCommissionConfig(user.id, commissionConfig);
            if (configResult.error) {
                toast.error(configResult.error);
                setIsLoading(false);
                return;
            }

            toast.success('User updated successfully');
            setOpen(false);
            setNewPassword('');
            if (onUpdate) onUpdate();
        } catch (error) {
            toast.error('An unexpected error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
            return;
        }

        setIsDeleting(true);
        try {
            const result = await deleteUser(user.id);
            if (result.error) {
                toast.error(result.error);
                return;
            }

            toast.success('User deleted successfully');
            setOpen(false);
            if (onUpdate) onUpdate();
        } catch (error) {
            toast.error('Failed to delete user');
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm">
                    <Settings className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] bg-[#1a1a1a] border-white/10 text-white">
                <DialogHeader>
                    <DialogTitle>Edit User: {user.name || user.email}</DialogTitle>
                    <DialogDescription>
                        {isSuperAdmin
                            ? 'Full user management including account details, role, and commission settings.'
                            : 'Modify role, job title, and commission settings.'
                        }
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue={isSuperAdmin ? "account" : "general"} className="w-full">
                    <TabsList className={`grid w-full bg-white/5 ${isSuperAdmin ? 'grid-cols-3' : 'grid-cols-2'}`}>
                        {isSuperAdmin && <TabsTrigger value="account">Account</TabsTrigger>}
                        <TabsTrigger value="general">General</TabsTrigger>
                        <TabsTrigger value="commission">Commissions</TabsTrigger>
                    </TabsList>

                    {/* Account Tab - Super Admin Only */}
                    {isSuperAdmin && (
                        <TabsContent value="account" className="py-4 space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Full Name</Label>
                                <Input
                                    id="name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="bg-white/5 border-white/10"
                                    placeholder="Enter name"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="email">Email Address</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="bg-white/5 border-white/10"
                                    placeholder="user@example.com"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="newPassword">New Password</Label>
                                <Input
                                    id="newPassword"
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="bg-white/5 border-white/10"
                                    placeholder="Leave blank to keep current"
                                />
                                <p className="text-xs text-muted-foreground">Leave blank to keep current password</p>
                            </div>

                            {/* Delete User Button */}
                            <div className="pt-4 border-t border-white/10">
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={handleDelete}
                                    disabled={isDeleting || user.role === 'super_admin'}
                                    className="w-full"
                                >
                                    {isDeleting ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <Trash2 className="mr-2 h-4 w-4" />
                                    )}
                                    Delete User
                                </Button>
                                {user.role === 'super_admin' && (
                                    <p className="text-xs text-muted-foreground mt-2 text-center">Cannot delete Super Admin accounts</p>
                                )}
                            </div>
                        </TabsContent>
                    )}

                    <TabsContent value="general" className="py-4 space-y-4">
                        {/* Job Type - Controls where user appears in lists */}
                        <div className="space-y-2">
                            <Label htmlFor="jobTitle">Job Type</Label>
                            <Select value={jobTitle} onValueChange={setJobTitle}>
                                <SelectTrigger className="bg-white/5 border-white/10">
                                    <SelectValue placeholder="Select job type" />
                                </SelectTrigger>
                                <SelectContent>
                                    {JOB_TITLE_OPTIONS.map(opt => (
                                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">Controls which lists this user appears in (Coach lists, Closer lists, etc.)</p>
                        </div>

                        {/* Permission Role - Controls access level */}
                        <div className="space-y-2">
                            <Label htmlFor="role">Permission Role</Label>
                            <Select value={role} onValueChange={(val: any) => setRole(val)} disabled={!isSuperAdmin && user.role === 'super_admin'}>
                                <SelectTrigger className="bg-white/5 border-white/10">
                                    <SelectValue placeholder="Select permission role" />
                                </SelectTrigger>
                                <SelectContent>
                                    {isSuperAdmin && <SelectItem value="super_admin">Super Admin (Full Access)</SelectItem>}
                                    <SelectItem value="admin">Admin (Elevated Access)</SelectItem>
                                    <SelectItem value="user">Standard (Permission-Based)</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">Super Admin bypasses all permission checks; Admin has management capabilities; Standard respects individual toggles</p>
                        </div>
                    </TabsContent>

                    <TabsContent value="commission" className="py-4 space-y-4">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between text-sm text-yellow-500/80 bg-yellow-500/10 p-3 rounded-md border border-yellow-500/20">
                                <span>Overrides global defaults.</span>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Company Lead Rate</Label>
                                    <div className="relative">
                                        <Input
                                            type="number"
                                            step="0.01"
                                            value={commissionConfig.company_driven_rate}
                                            onChange={(e) => setCommissionConfig({ ...commissionConfig, company_driven_rate: parseFloat(e.target.value) })}
                                            className="bg-white/5 border-white/10 pr-8"
                                        />
                                        <span className="absolute right-3 top-2.5 text-xs text-muted-foreground">%</span>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground">e.g. 0.30 for 30%</p>
                                </div>
                                <div className="space-y-2">
                                    <Label>Self-Gen Rate</Label>
                                    <div className="relative">
                                        <Input
                                            type="number"
                                            step="0.01"
                                            value={commissionConfig.self_gen_rate}
                                            onChange={(e) => setCommissionConfig({ ...commissionConfig, self_gen_rate: parseFloat(e.target.value) })}
                                            className="bg-white/5 border-white/10 pr-8"
                                        />
                                        <span className="absolute right-3 top-2.5 text-xs text-muted-foreground">%</span>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground">e.g. 0.50 for 50%</p>
                                </div>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>

                <DialogFooter>
                    <Button variant="ghost" onClick={() => setOpen(false)} disabled={isLoading}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={isLoading} className="bg-emerald-600 hover:bg-emerald-700">
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

