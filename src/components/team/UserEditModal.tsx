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
import { User, updateUserRole, updateUserCommissionConfig, updateUserJobTitle, updateUserDetails, deleteUser, uploadAvatarForUser, updateCoachProfile } from '@/lib/actions/profile';
import { getCalLinksForUser, upsertCalLink, type CalUserLink, type CalLinkType } from '@/lib/actions/cal-links';
import { toast } from 'sonner';
import { Loader2, Settings, Trash2, Calendar, User as UserIcon, Eye } from 'lucide-react';
import { useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ImageCropper } from '@/components/ui/ImageCropper';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Camera } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';


interface UserEditModalProps {
    user: User;
    onUpdate?: () => void;
    isSuperAdmin?: boolean;
}

const JOB_TITLE_OPTIONS = [
    { value: 'coach', label: 'Coach' },
    { value: 'head_coach', label: 'Head Coach' },
    { value: 'closer', label: 'Closer' },
    { value: 'setter', label: 'Setter' },
    { value: 'admin_staff', label: 'Admin Staff' },
    { value: 'operations', label: 'Operations' },
]

// Job titles that have calendar links
const CAL_LINK_JOB_TITLES = ['coach', 'head_coach', 'closer']

export function UserEditModal({ user, onUpdate, isSuperAdmin = false }: UserEditModalProps) {
    const [open, setOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // General Tab
    const [role, setRole] = useState(user.role);
    const [jobTitle, setJobTitle] = useState<string>(user.job_title || 'coach');
    const [slackUserId, setSlackUserId] = useState<string>(user.slack_user_id || '');

    // Coach Profile Tab
    const [publicRole, setPublicRole] = useState(user.public_role || '');
    const [bio, setBio] = useState(user.bio || '');
    const [specialties, setSpecialties] = useState(user.specialties?.join(', ') || '');
    const [showOnFemale, setShowOnFemale] = useState(user.display_on_female_landing || false);
    const [showOnMale, setShowOnMale] = useState(user.display_on_male_landing || false);
    const [displayOrder, setDisplayOrder] = useState<number | string>(user.display_order || 999);
    const [slug, setSlug] = useState(user.slug || '');


    // Account Tab (Super Admin only)
    const [name, setName] = useState(user.name || '');
    const [email, setEmail] = useState(user.email);
    const [newPassword, setNewPassword] = useState('');

    // Commission Tab
    const [commissionConfig, setCommissionConfig] = useState<Record<string, number>>({
        company_driven_rate: user.commission_config?.company_driven_rate || 0.30,
        self_gen_rate: user.commission_config?.self_gen_rate || 0.50
    });

    // Image Upload State
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [cropperOpen, setCropperOpen] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [avatarUrl, setAvatarUrl] = useState<string | null>(user.avatar_url);

    // Calendar Links State
    const [calLinks, setCalLinks] = useState<CalUserLink[]>([]);
    const [calLinksLoading, setCalLinksLoading] = useState(false);
    const [consultUrl, setConsultUrl] = useState('');
    const [consultEventTypeId, setConsultEventTypeId] = useState('');
    const [monthlyCoachingUrl, setMonthlyCoachingUrl] = useState('');

    // Check if user should have calendar links
    const hasCalendarLinks = CAL_LINK_JOB_TITLES.includes(jobTitle);

    // Load calendar links when modal opens or job title changes
    useEffect(() => {
        if (open && hasCalendarLinks) {
            loadCalLinks();
        }
    }, [open, jobTitle]);

    const loadCalLinks = async () => {
        setCalLinksLoading(true);
        try {
            const links = await getCalLinksForUser(user.id);
            setCalLinks(links);

            // Set individual URL states
            const consult = links.find(l => l.link_type === 'consult');
            const monthly = links.find(l => l.link_type === 'monthly_coaching');
            setConsultUrl(consult?.url || '');
            setConsultEventTypeId(consult?.event_type_id?.toString() || '');
            setMonthlyCoachingUrl(monthly?.url || '');
        } catch (error) {
            console.error('Failed to load calendar links:', error);
        } finally {
            setCalLinksLoading(false);
        }
    };

    const saveCalLink = async (linkType: CalLinkType, url: string) => {
        if (!url.trim()) return;

        const displayName = linkType === 'consult' ? 'Coaching Consult' : 'Monthly Coaching Call';
        const eventTypeId = linkType === 'consult' && consultEventTypeId ? parseInt(consultEventTypeId) : null;
        const result = await upsertCalLink(user.id, linkType, url, displayName, eventTypeId);

        if (result.success) {
            toast.success(`${displayName} link saved`);
            loadCalLinks();
        } else {
            toast.error(result.error || 'Failed to save calendar link');
        }
    };

    const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            const imageDataUrl = await readFile(file);
            setImageSrc(imageDataUrl);
            setCropperOpen(true);
        }
    };

    const readFile = (file: File): Promise<string> => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.addEventListener('load', () => resolve(reader.result as string), false);
            reader.readAsDataURL(file);
        });
    };

    const handleCropComplete = async (croppedBlob: Blob) => {
        setUploading(true);
        try {
            // Convert blob to base64 for server action
            const reader = new FileReader();
            const base64Promise = new Promise<string>((resolve, reject) => {
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(croppedBlob);
            });

            const base64Data = await base64Promise;

            // Use server action to upload (bypasses storage RLS)
            const result = await uploadAvatarForUser(user.id, base64Data);

            if (result.error) {
                toast.error(`Upload failed: ${result.error}`);
                return;
            }

            if (result.url) {
                setAvatarUrl(result.url);
                toast.success('Image uploaded! Click Save to apply.');
            }

        } catch (error: any) {
            console.error('Error handling crop:', error);
            toast.error(`Something went wrong: ${error?.message || 'Unknown error'}`);
        } finally {
            setUploading(false);
        }
    };

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
                const detailsToUpdate: { name?: string; email?: string; password?: string; slack_user_id?: string | null } = {};
                if (name !== user.name) detailsToUpdate.name = name;
                if (email !== user.email) detailsToUpdate.email = email;
                if (newPassword) detailsToUpdate.password = newPassword;
                if (slackUserId !== (user.slack_user_id || '')) {
                    detailsToUpdate.slack_user_id = slackUserId || null;
                }

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

            // Update Coach Profile & Avatar
            // Parse specialties string into array
            const specialtiesArray = specialties
                .split(',')
                .map(s => s.trim())
                .filter(s => s.length > 0);

            const profileResult = await updateCoachProfile(user.id, {
                bio,
                public_role: publicRole,
                specialties: specialtiesArray,
                display_on_female_landing: showOnFemale,
                display_on_male_landing: showOnMale,
                avatar_url: avatarUrl || undefined, // Pass updated avatar URL
                display_order: typeof displayOrder === 'string' ? (parseInt(displayOrder) || 999) : displayOrder,
                slug: slug || undefined
            });

            if (profileResult.error) {
                toast.error(profileResult.error);
                setIsLoading(false);
                return;
            }

            // Fallback for avatar update if using Super Admin flow for account details
            // (Handled above in updateUserDetails for super admin, but updateCoachProfile covers it for everyone else)
            // If super admin flow ran, it might have updated avatar_url via updateUserDetails if passed
            // Check if we need to reconcile. updateUserDetails handles avatar_url too.
            // Actually, updateUserDetails in previous code didn't accept avatar_url in the 'data' object type properly?
            // Let's check updateUserDetails in profile.ts - Yes it accepts avatar_url.
            // My code block for Super Admin above DOES NOT pass avatar_url to updateUserDetails.
            // So updateCoachProfile handles avatar_url for everyone. Good.

            toast.success('User updated successfully');
            setOpen(false);
            setNewPassword('');
            if (onUpdate) onUpdate();
        } catch (error) {
            console.error(error);
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
            <DialogContent className="sm:max-w-[600px] bg-[#1a1a1a] border-white/10 text-white max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Edit User: {user.name || user.email}</DialogTitle>
                    <DialogDescription>
                        Manage profile, permissions, and visibility settings.
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="general" className="w-full">
                    <TabsList className={`grid w-full bg-white/5 ${isSuperAdmin
                        ? (hasCalendarLinks ? 'grid-cols-5' : 'grid-cols-4')
                        : (hasCalendarLinks ? 'grid-cols-4' : 'grid-cols-3')
                        }`}>
                        <TabsTrigger value="general">General</TabsTrigger>
                        <TabsTrigger value="profile">Profile</TabsTrigger>
                        <TabsTrigger value="commission">Comms</TabsTrigger>
                        {hasCalendarLinks && <TabsTrigger value="calendar">Calendar</TabsTrigger>}
                        {isSuperAdmin && <TabsTrigger value="account">Account</TabsTrigger>}
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

                    <TabsContent value="general" className="py-4 space-y-6">
                        {/* Avatar Upload */}
                        <div className="flex flex-col items-center justify-center space-y-4">
                            <div className="relative group">
                                <Avatar className="w-24 h-24 border-2 border-white/10">
                                    <AvatarImage src={avatarUrl || undefined} className="object-cover" />
                                    <AvatarFallback className="bg-white/10 text-2xl">
                                        {user.name?.charAt(0) || user.email.charAt(0)}
                                    </AvatarFallback>
                                </Avatar>
                                <label
                                    htmlFor="avatar-upload"
                                    className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-full cursor-pointer"
                                >
                                    <Camera className="w-8 h-8 text-white" />
                                </label>
                                <input
                                    id="avatar-upload"
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={onFileChange}
                                    disabled={uploading}
                                />
                            </div>
                            <div className="text-xs text-muted-foreground text-center">
                                Click to upload new photo
                            </div>
                        </div>

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
                            <p className="text-xs text-muted-foreground">Controls which lists this user appears in</p>
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
                                    {isSuperAdmin && <SelectItem value="admin">Admin (Elevated Access)</SelectItem>}
                                    <SelectItem value="user">Standard (Permission-Based)</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">Super Admin bypasses all permission checks; Admin has management capabilities; Standard respects individual toggles</p>
                        </div>

                        {/* Slack Integration */}
                        <div className="space-y-2">
                            <Label htmlFor="slackUserId">Slack User ID</Label>
                            <Input
                                id="slackUserId"
                                value={slackUserId}
                                onChange={(e) => setSlackUserId(e.target.value)}
                                className="bg-white/5 border-white/10"
                                placeholder="e.g., U0G9QF9C6"
                            />
                            <p className="text-xs text-muted-foreground">
                                For Slack notifications. Find it in Slack: Profile → ⋯ → Copy member ID
                            </p>
                        </div>
                    </TabsContent>

                    <TabsContent value="profile" className="py-4 space-y-6">
                        <div className="flex items-center gap-2 text-sm text-blue-500/80 bg-blue-500/10 p-3 rounded-md border border-blue-500/20 mb-4">
                            <UserIcon className="w-4 h-4" />
                            <span>These details appear on the landing page for Coaches.</span>
                        </div>

                        {/* Visibility Toggles */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col space-y-2 p-3 border border-white/5 rounded-lg bg-white/5">
                                <Label className="text-xs text-muted-foreground">Show on Female Page</Label>
                                <div className="flex items-center justify-between">
                                    <span className={`text-sm ${showOnFemale ? 'text-green-400' : 'text-gray-400'}`}>
                                        {showOnFemale ? 'Visible' : 'Hidden'}
                                    </span>
                                    <Switch checked={showOnFemale} onCheckedChange={setShowOnFemale} />
                                </div>
                            </div>
                            <div className="flex flex-col space-y-2 p-3 border border-white/5 rounded-lg bg-white/5">
                                <Label className="text-xs text-muted-foreground">Show on Male Page</Label>
                                <div className="flex items-center justify-between">
                                    <span className={`text-sm ${showOnMale ? 'text-green-400' : 'text-gray-400'}`}>
                                        {showOnMale ? 'Visible' : 'Hidden'}
                                    </span>
                                    <Switch checked={showOnMale} onCheckedChange={setShowOnMale} />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="displayOrder">Display Order</Label>
                            <Input
                                id="displayOrder"
                                type="number"
                                value={displayOrder}
                                onChange={(e) => setDisplayOrder(e.target.value)}
                                className="bg-white/5 border-white/10"
                                placeholder="999"
                            />
                            <p className="text-xs text-muted-foreground">Lower numbers appear first. Default is 999.</p>
                        </div>


                        <div className="space-y-2">
                            <Label htmlFor="publicRole">Public Role Title</Label>
                            <Input
                                id="publicRole"
                                value={publicRole}
                                onChange={(e) => setPublicRole(e.target.value)}
                                className="bg-white/5 border-white/10"
                                placeholder="e.g. Women's Lifestyle Coach"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="slug">Custom URL Slug</Label>
                            <Input
                                id="slug"
                                value={slug}
                                onChange={(e) => setSlug(e.target.value)}
                                className="bg-white/5 border-white/10"
                                placeholder="e.g. matt, sarah (must be unique)"
                            />
                            <p className="text-xs text-muted-foreground">Used for direct booking links (e.g. /booking?coach=matt)</p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="specialties">Specialties (comma separated)</Label>
                            <Input
                                id="specialties"
                                value={specialties}
                                onChange={(e) => setSpecialties(e.target.value)}
                                className="bg-white/5 border-white/10"
                                placeholder="e.g. Fat Loss, contest prep, hormones"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="bio">Biography</Label>
                            <Textarea
                                id="bio"
                                value={bio}
                                onChange={(e) => setBio(e.target.value)}
                                className="bg-white/5 border-white/10 min-h-[120px]"
                                placeholder="Coach's bio..."
                            />
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

                    {/* Calendar Links Tab */}
                    {hasCalendarLinks && (
                        <TabsContent value="calendar" className="py-4 space-y-4">
                            {calLinksLoading ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="flex items-center gap-2 text-sm text-blue-500/80 bg-blue-500/10 p-3 rounded-md border border-blue-500/20">
                                        <Calendar className="w-4 h-4" />
                                        <span>Configure Cal.com booking links for this user.</span>
                                    </div>

                                    {/* Consult Calendar (for sales calls) */}
                                    <div className="space-y-2">
                                        <Label htmlFor="consultUrl">Coaching Consult Calendar</Label>
                                        <div className="grid gap-2">
                                            <Input
                                                id="consultUrl"
                                                value={consultUrl}
                                                onChange={(e) => setConsultUrl(e.target.value)}
                                                className="bg-white/5 border-white/10"
                                                placeholder="https://cal.com/username/consult"
                                            />
                                            <div className="flex gap-2">
                                                <div className="flex-1">
                                                    <Input
                                                        id="consultEventTypeId"
                                                        value={consultEventTypeId}
                                                        onChange={(e) => setConsultEventTypeId(e.target.value)}
                                                        className="bg-white/5 border-white/10"
                                                        placeholder="Event Type ID (e.g. 1234567)"
                                                        type="number"
                                                    />
                                                </div>
                                                <Button
                                                    size="sm"
                                                    onClick={() => saveCalLink('consult', consultUrl)}
                                                    disabled={!consultUrl.trim()}
                                                    className="bg-emerald-600 hover:bg-emerald-700 whitespace-nowrap"
                                                >
                                                    Save & Update
                                                </Button>
                                            </div>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Used for sales calls. Event Type ID is required for the booking funnel. Source parameter will be added automatically.
                                        </p>
                                    </div>

                                    {/* Monthly Coaching Calendar (for coaches only) */}
                                    {(jobTitle === 'coach' || jobTitle === 'head_coach') && (
                                        <div className="space-y-2">
                                            <Label htmlFor="monthlyCoachingUrl">Monthly Coaching Calendar</Label>
                                            <div className="flex gap-2">
                                                <Input
                                                    id="monthlyCoachingUrl"
                                                    value={monthlyCoachingUrl}
                                                    onChange={(e) => setMonthlyCoachingUrl(e.target.value)}
                                                    className="bg-white/5 border-white/10 flex-1"
                                                    placeholder="https://cal.com/username/monthly-checkin"
                                                />
                                                <Button
                                                    size="sm"
                                                    onClick={() => saveCalLink('monthly_coaching', monthlyCoachingUrl)}
                                                    disabled={!monthlyCoachingUrl.trim()}
                                                    className="bg-emerald-600 hover:bg-emerald-700"
                                                >
                                                    Save
                                                </Button>
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                Used for existing client check-ins. This link appears on client profiles.
                                            </p>
                                        </div>
                                    )}

                                    {/* Current Links Display */}
                                    {calLinks.length > 0 && (
                                        <div className="pt-4 border-t border-white/10">
                                            <h4 className="text-sm font-medium mb-3">Current Links</h4>
                                            <div className="space-y-2">
                                                {calLinks.map(link => (
                                                    <div key={link.id} className="flex items-center justify-between text-sm bg-white/5 p-2 rounded">
                                                        <span className="font-medium">{link.display_name || link.link_type}</span>
                                                        <span className="text-xs text-muted-foreground truncate max-w-[200px]">{link.url}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </TabsContent>
                    )}
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
                <ImageCropper
                    open={cropperOpen}
                    onOpenChange={setCropperOpen}
                    imageSrc={imageSrc}
                    onCropComplete={handleCropComplete}
                />
            </DialogContent>
        </Dialog>
    );
}

