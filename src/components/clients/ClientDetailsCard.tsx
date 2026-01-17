'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Phone, Edit2, Save, X, Loader2, ExternalLink } from 'lucide-react';
import { Client } from '@/types/client';
import { updateClient } from '@/lib/actions/clients';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface ClientDetailsCardProps {
    client: Client;
    ghlLocationId?: string;
}

export function ClientDetailsCard({ client, ghlLocationId }: ClientDetailsCardProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const [formData, setFormData] = useState({
        name: client.name,
        email: client.email,
        phone: client.phone || '',
        stripe_customer_id: client.stripe_customer_id || '',
    });

    const handleSave = async () => {
        setIsLoading(true);
        try {
            const result = await updateClient(client.id, {
                ...formData,
                ghl_contact_id: client.ghl_contact_id // Pass this so action knows to sync
            });

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
        <Card className="bg-card/40 border-primary/5 backdrop-blur-sm relative overflow-hidden transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Contact Details</CardTitle>
                {!isEditing && (
                    <Button variant="ghost" size="icon" onClick={() => setIsEditing(true)} className="h-8 w-8 text-muted-foreground hover:text-primary">
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
                        <div className="space-y-1">
                            <Label htmlFor="stripe_customer_id">Stripe Customer ID</Label>
                            <Input
                                id="stripe_customer_id"
                                value={formData.stripe_customer_id}
                                onChange={(e) => setFormData({ ...formData, stripe_customer_id: e.target.value })}
                                placeholder="cus_..."
                            />
                        </div>
                        <div className="flex gap-2 pt-2">
                            <Button size="sm" onClick={handleSave} disabled={isLoading}>
                                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                                Save
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)} disabled={isLoading}>
                                <X className="h-4 w-4 mr-1" /> Cancel
                            </Button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="space-y-1 group">
                            <label className="text-xs font-medium text-muted-foreground group-hover:text-primary transition-colors">Email</label>
                            <div className="flex items-center gap-2 text-sm truncate">
                                <Mail className="h-3 w-3 text-primary shrink-0" />
                                <span className="truncate" title={client.email}>{client.email}</span>
                            </div>
                        </div>
                        <div className="space-y-1 group">
                            <label className="text-xs font-medium text-muted-foreground group-hover:text-primary transition-colors">Phone</label>
                            <div className="flex items-center gap-2 text-sm">
                                <Phone className="h-3 w-3 text-primary shrink-0" />
                                {client.phone || <span className="text-muted-foreground italic">N/A</span>}
                            </div>
                        </div>

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
                    </>
                )}
            </CardContent>
        </Card >
    );
}
