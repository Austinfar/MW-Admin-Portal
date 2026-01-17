'use client';

import { useState, useRef } from 'react';
import { UserProfile, updateProfile, updateAvatar } from '@/lib/actions/profile';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { Loader2, Camera, User, Mail, Phone, Shield, Calendar } from 'lucide-react';
import { format } from 'date-fns';

interface ProfileFormProps {
    profile: UserProfile;
}

export function ProfileForm({ profile }: ProfileFormProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url || '');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Parse name into first/last if not already split
    const nameParts = profile.name?.split(' ') || [];
    const defaultFirstName = profile.first_name || nameParts[0] || '';
    const defaultLastName = profile.last_name || nameParts.slice(1).join(' ') || '';

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsLoading(true);

        const formData = new FormData(e.currentTarget);
        const result = await updateProfile(formData);

        setIsLoading(false);

        if (result.error) {
            toast.error(result.error);
        } else {
            toast.success('Profile updated successfully');
        }
    };

    const handleAvatarClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // For now, we'll use a data URL. In production, you'd upload to Supabase Storage
        const reader = new FileReader();
        reader.onloadend = async () => {
            const dataUrl = reader.result as string;
            setAvatarUrl(dataUrl);

            const result = await updateAvatar(dataUrl);
            if (result.error) {
                toast.error(result.error);
            } else {
                toast.success('Profile picture updated');
            }
        };
        reader.readAsDataURL(file);
    };

    const getInitials = () => {
        const first = defaultFirstName?.[0] || '';
        const last = defaultLastName?.[0] || '';
        return (first + last).toUpperCase() || profile.email?.[0]?.toUpperCase() || 'U';
    };

    const getRoleBadgeVariant = (role: string) => {
        switch (role) {
            case 'admin':
                return 'default';
            case 'coach':
                return 'secondary';
            case 'sales_closer':
                return 'outline';
            default:
                return 'secondary';
        }
    };

    const getRoleDisplay = (role: string) => {
        switch (role) {
            case 'admin':
                return 'Administrator';
            case 'coach':
                return 'Coach';
            case 'sales_closer':
                return 'Sales Closer';
            default:
                return role;
        }
    };

    return (
        <div className="space-y-6">
            {/* Profile Picture Card */}
            <Card className="bg-card/40 border-primary/5">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Camera className="h-5 w-5" />
                        Profile Picture
                    </CardTitle>
                    <CardDescription>
                        Click on the avatar to upload a new profile picture.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-6">
                        <div className="relative group cursor-pointer" onClick={handleAvatarClick}>
                            <Avatar className="h-24 w-24 border-4 border-primary/20">
                                <AvatarImage src={avatarUrl} alt={profile.name} />
                                <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                                    {getInitials()}
                                </AvatarFallback>
                            </Avatar>
                            <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                <Camera className="h-8 w-8 text-white" />
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleFileChange}
                            />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-lg font-semibold">{profile.name || 'User'}</h3>
                            <p className="text-sm text-muted-foreground">{profile.email}</p>
                            <Badge variant={getRoleBadgeVariant(profile.role)} className="mt-2">
                                <Shield className="h-3 w-3 mr-1" />
                                {getRoleDisplay(profile.role)}
                            </Badge>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Personal Information Card */}
            <Card className="bg-card/40 border-primary/5">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <User className="h-5 w-5" />
                        Personal Information
                    </CardTitle>
                    <CardDescription>
                        Update your personal details here.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="first_name">First Name</Label>
                                <Input
                                    id="first_name"
                                    name="first_name"
                                    defaultValue={defaultFirstName}
                                    placeholder="John"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="last_name">Last Name</Label>
                                <Input
                                    id="last_name"
                                    name="last_name"
                                    defaultValue={defaultLastName}
                                    placeholder="Doe"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email" className="flex items-center gap-2">
                                <Mail className="h-4 w-4" />
                                Email Address
                            </Label>
                            <Input
                                id="email"
                                name="email"
                                type="email"
                                value={profile.email}
                                disabled
                                className="bg-muted/50"
                            />
                            <p className="text-xs text-muted-foreground">
                                Email cannot be changed. Contact an administrator if you need to update it.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="phone" className="flex items-center gap-2">
                                <Phone className="h-4 w-4" />
                                Phone Number
                            </Label>
                            <Input
                                id="phone"
                                name="phone"
                                type="tel"
                                defaultValue={profile.phone || ''}
                                placeholder="+1 (555) 123-4567"
                            />
                        </div>

                        <Button type="submit" disabled={isLoading} className="w-full md:w-auto">
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                'Save Changes'
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {/* Account Information Card */}
            <Card className="bg-card/40 border-primary/5">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5" />
                        Account Information
                    </CardTitle>
                    <CardDescription>
                        View your account details and role.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between py-2 border-b border-border/50">
                            <div>
                                <p className="text-sm font-medium">Role</p>
                                <p className="text-xs text-muted-foreground">Your current role in the system</p>
                            </div>
                            <Badge variant={getRoleBadgeVariant(profile.role)}>
                                {getRoleDisplay(profile.role)}
                            </Badge>
                        </div>
                        <div className="flex items-center justify-between py-2 border-b border-border/50">
                            <div>
                                <p className="text-sm font-medium">Account Status</p>
                                <p className="text-xs text-muted-foreground">Whether your account is active</p>
                            </div>
                            <Badge variant={profile.is_active ? 'default' : 'destructive'}>
                                {profile.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                        </div>
                        <div className="flex items-center justify-between py-2">
                            <div>
                                <p className="text-sm font-medium flex items-center gap-2">
                                    <Calendar className="h-4 w-4" />
                                    Member Since
                                </p>
                                <p className="text-xs text-muted-foreground">When you joined</p>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                {format(new Date(profile.created_at), 'MMMM d, yyyy')}
                            </p>
                        </div>
                        <div className="flex items-center justify-between py-2">
                            <div>
                                <p className="text-sm font-medium flex items-center gap-2">
                                    <span className="text-muted-foreground">$</span>
                                    Commission Rate
                                </p>
                                <p className="text-xs text-muted-foreground">Your specific commission override</p>
                            </div>
                            <p className="text-sm font-medium">
                                {profile.commission_rate
                                    ? `${(profile.commission_rate * 100).toFixed(0)}%`
                                    : 'Default'}
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
