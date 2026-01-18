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
import { User, updateUserRole, updateUserCommissionConfig } from '@/lib/actions/profile';
import { toast } from 'sonner';
import { Loader2, Settings } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface UserEditModalProps {
    user: User;
    onUpdate?: () => void;
}

export function UserEditModal({ user, onUpdate }: UserEditModalProps) {
    const [open, setOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [role, setRole] = useState(user.role);
    const [commissionConfig, setCommissionConfig] = useState<Record<string, number>>({
        company_driven_rate: user.commission_config?.company_driven_rate || 0.30,
        self_gen_rate: user.commission_config?.self_gen_rate || 0.50
    });

    const handleSave = async () => {
        setIsLoading(true);
        try {
            // Update Role
            if (role !== user.role) {
                const roleResult = await updateUserRole(user.id, role);
                if (roleResult.error) {
                    toast.error(roleResult.error);
                    setIsLoading(false);
                    return;
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
            if (onUpdate) onUpdate();
        } catch (error) {
            toast.error('An unexpected error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm">
                    <Settings className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-[#1a1a1a] border-white/10 text-white">
                <DialogHeader>
                    <DialogTitle>Edit User: {user.name}</DialogTitle>
                    <DialogDescription>
                        Modify role and commission settings.
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="general" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 bg-white/5">
                        <TabsTrigger value="general">General</TabsTrigger>
                        <TabsTrigger value="commission">Commissions</TabsTrigger>
                    </TabsList>

                    <TabsContent value="general" className="py-4 space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="role">Role</Label>
                            <Select value={role} onValueChange={(val: any) => setRole(val)}>
                                <SelectTrigger className="bg-white/5 border-white/10">
                                    <SelectValue placeholder="Select role" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="coach">Coach</SelectItem>
                                    <SelectItem value="sales_closer">Sales Closer</SelectItem>
                                    <SelectItem value="admin">Admin</SelectItem>
                                </SelectContent>
                            </Select>
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
