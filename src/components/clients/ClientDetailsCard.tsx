'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Phone, Edit2, Save, X, Loader2, ExternalLink, Activity } from 'lucide-react';
import { Client, ClientStatus } from '@/types/client';
import { updateClient, Coach } from '@/lib/actions/clients';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

interface ClientDetailsCardProps {
    client: Client;
    ghlLocationId?: string;
    users?: Coach[]; // Optional list of coaches/admins for selection
    isAdmin?: boolean;
}

export function ClientDetailsCard({ client, ghlLocationId, users = [], isAdmin = false }: ClientDetailsCardProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const [formData, setFormData] = useState({
        name: client.name,
        email: client.email,
        phone: client.phone || '',
        stripe_customer_id: client.stripe_customer_id || '',
        status: client.status,
        sold_by_user_id: client.sold_by_user_id || 'none',
        assigned_coach_id: client.assigned_coach_id || 'none',
        lead_source: client.lead_source || 'company_driven',
        check_in_day: client.check_in_day || 'none',
        appointment_setter_id: client.appointment_setter_id || 'none'
    });

    const handleSave = async () => {
        setIsLoading(true);
        try {
            // Convert 'none' placeholder values back to null for database
            const cleanedData = {
                ...formData,
                sold_by_user_id: formData.sold_by_user_id === 'none' ? null : formData.sold_by_user_id,
                assigned_coach_id: formData.assigned_coach_id === 'none' ? null : formData.assigned_coach_id,
                appointment_setter_id: formData.appointment_setter_id === 'none' ? null : formData.appointment_setter_id,
                check_in_day: formData.check_in_day === 'none' ? null : formData.check_in_day,
                ghl_contact_id: client.ghl_contact_id // Pass this so action knows to sync
            };
            const result = await updateClient(client.id, cleanedData);

            if (result.error) {
                toast.error('Failed to update profile');
            } else {
                toast.success('Profile updated successfully');
                setIsEditing(false);
                router.refresh();
            }
        } catch (error) {
            toast.error('An unexpected error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card className="bg-card/50 backdrop-blur-xl border-white/5 hover:border-primary/20 transition-all duration-300 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)] relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Contact Details</CardTitle>
                {!isEditing && (
                    <Button variant="ghost" size="icon" onClick={() => setIsEditing(true)} className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-white/10">
                        <Edit2 className="h-4 w-4" />
                    </Button>
                )}
            </CardHeader>
            <CardContent className="space-y-4">
                {isEditing ? (
                    <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="space-y-1">
                            <Label htmlFor="name">Full Name</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="max-w-full"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="phone">Phone</Label>
                            <Input
                                id="phone"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            />
                        </div>

                        {/* Sales Info (Admin functionality mainly, but visible here) */}
                        <div className="pt-2 border-t border-primary/10">
                            <Label className="text-xs font-semibold text-primary mb-2 block">Sales Attribution</Label>
                            <div className="space-y-3">
                                <div className="space-y-1">
                                    <Label htmlFor="sold_by">Sold By (Closer)</Label>
                                    <Select
                                        value={formData.sold_by_user_id}
                                        onValueChange={(value) => setFormData({ ...formData, sold_by_user_id: value })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Closer" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">-- None --</SelectItem>
                                            {users.map(u => (
                                                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="appointment_setter">Appointment Setter</Label>
                                    <Select
                                        value={formData.appointment_setter_id}
                                        onValueChange={(value) => setFormData({ ...formData, appointment_setter_id: value })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Setter" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">-- None --</SelectItem>
                                            {users.map(u => (
                                                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="lead_source">Lead Source</Label>
                                    <Select
                                        value={formData.lead_source}
                                        onValueChange={(value: any) => setFormData({ ...formData, lead_source: value })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Source" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="company_driven">Company Driven</SelectItem>
                                            <SelectItem value="coach_driven">Coach Self-Gen</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        {/* Coach Assignment - similar to Sales but specifically for fulfillment */}
                        <div className="pt-2 border-t border-primary/10">
                            <Label className="text-xs font-semibold text-primary mb-2 block">Team Assignment</Label>
                            <div className="space-y-1">
                                <Label htmlFor="assigned_coach">Assigned Coach</Label>
                                <Select
                                    value={formData.assigned_coach_id}
                                    onValueChange={(value) => setFormData({ ...formData, assigned_coach_id: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Coach" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">-- Unassigned --</SelectItem>
                                        {users.map(u => (
                                            <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="stripe_customer_id">Stripe Customer ID</Label>
                            <Input
                                id="stripe_customer_id"
                                value={formData.stripe_customer_id}
                                onChange={(e) => setFormData({ ...formData, stripe_customer_id: e.target.value })}
                                placeholder="cus_..."
                                disabled={!isAdmin}
                                className={!isAdmin ? "opacity-60 cursor-not-allowed" : ""}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="status">Client Status</Label>
                            <Select
                                value={formData.status}
                                onValueChange={(value: ClientStatus) => setFormData({ ...formData, status: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="onboarding">Onboarding</SelectItem>
                                    <SelectItem value="inactive">Inactive</SelectItem>
                                    <SelectItem value="lost">Lost</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex gap-2 pt-2 flex-wrap">
                            <Button size="sm" onClick={handleSave} disabled={isLoading} className="flex-1 sm:flex-none">
                                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                                Save
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)} disabled={isLoading} className="flex-1 sm:flex-none">
                                <X className="h-4 w-4 mr-1" /> Cancel
                            </Button>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Contact Buttons */}
                        <div className="grid grid-cols-2 gap-2 pb-2 border-b border-white/5">
                            <a
                                href={`mailto:${client.email}`}
                                className="flex items-center justify-center gap-2 p-2 rounded-md bg-primary/10 hover:bg-primary/20 text-primary transition-colors text-xs font-medium"
                            >
                                <Mail className="h-3.5 w-3.5" />
                                Email
                            </a>
                            {client.phone ? (
                                <a
                                    href={`tel:${client.phone}`}
                                    className="flex items-center justify-center gap-2 p-2 rounded-md bg-primary/10 hover:bg-primary/20 text-primary transition-colors text-xs font-medium"
                                >
                                    <Phone className="h-3.5 w-3.5" />
                                    Call/SMS
                                </a>
                            ) : (
                                <div className="flex items-center justify-center gap-2 p-2 rounded-md bg-muted text-muted-foreground text-xs font-medium opacity-50 cursor-not-allowed">
                                    <Phone className="h-3.5 w-3.5" />
                                    No Phone
                                </div>
                            )}
                        </div>

                        <div className="space-y-1 group">
                            <label className="text-xs font-medium text-muted-foreground group-hover:text-primary transition-colors">Email</label>
                            <div className="flex items-center gap-2 text-sm truncate">
                                <span className="truncate" title={client.email}>{client.email}</span>
                            </div>
                        </div>
                        <div className="space-y-1 group">
                            <label className="text-xs font-medium text-muted-foreground group-hover:text-primary transition-colors">Phone</label>
                            <div className="flex items-center gap-2 text-sm">
                                {client.phone || <span className="text-muted-foreground italic">N/A</span>}
                            </div>
                        </div>


                        {client.check_in_day && (
                            <div className="pt-2 border-t border-white/5 space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">Check-in Day</label>
                                <div className="text-sm font-medium flex items-center gap-2">
                                    <Activity className="h-3 w-3 text-primary" />
                                    {client.check_in_day}
                                </div>
                            </div>
                        )}

                        {/* Sales Info Display */}
                        {(client.sold_by_user || client.lead_source || client.appointment_setter) && (
                            <div className="pt-2 border-t border-white/5 space-y-2">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Sold By (Closer)</label>
                                    <div className="text-sm font-medium">
                                        {client.sold_by_user?.name || <span className="text-muted-foreground italic">Unassigned</span>}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Appointment Setter</label>
                                    <div className="text-sm font-medium">
                                        {client.appointment_setter?.name || <span className="text-muted-foreground italic">Unassigned</span>}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Lead Source</label>
                                    <div className="text-sm">
                                        {client.lead_source === 'coach_driven'
                                            ? <span className="text-emerald-500 font-medium">Coach Self-Gen</span>
                                            : <span className="text-muted-foreground">Company Driven</span>}
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="space-y-1">

                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">Stripe ID</label>
                                <div className="flex items-center gap-2">
                                    <div className={`text-xs font-mono p-1.5 rounded overflow-hidden text-ellipsis border transition-colors flex-1 ${client.stripe_customer_id
                                        ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                        : 'bg-secondary/20 text-muted-foreground border-transparent'
                                        }`}>
                                        {client.stripe_customer_id || 'Not Linked'}
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground flex items-center justify-between">
                                    <span>GHL Contact ID</span>
                                    {client.ghl_contact_id && ghlLocationId && (
                                        <a
                                            href={`https://app.gohighlevel.com/v2/location/${ghlLocationId}/contacts/detail/${client.ghl_contact_id}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-[10px] text-primary hover:underline flex items-center gap-1"
                                        >
                                            View in GHL
                                            <ExternalLink className="h-3 w-3" />
                                        </a>
                                    )}
                                </label>
                                <div className="text-xs font-mono bg-secondary/20 p-1.5 rounded text-muted-foreground overflow-hidden text-ellipsis border border-transparent hover:border-primary/10 transition-colors">
                                    {client.ghl_contact_id || 'Not Synced'}
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </CardContent>
        </Card >
    );
}
