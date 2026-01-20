'use client';

import { useEffect, useState } from 'react';
import { getInvitations, revokeInvitation, Invitation } from '@/lib/actions/invitations';
import { getAllUsers, User, getCurrentUserProfile, reactivateUser } from '@/lib/actions/profile';
import { CreateUserDialog } from '@/components/team/CreateUserDialog';
import { UserEditModal } from '@/components/team/UserEditModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { Trash2, Shield, ChevronDown, ChevronUp, UserCheck, Users } from 'lucide-react';
import { PermissionToggles } from './PermissionToggles';
import { UserAccess } from '@/lib/auth-utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export function TeamSettingsClient() {
    const [invitations, setInvitations] = useState<Invitation[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedUser, setExpandedUser] = useState<string | null>(null);
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [showInactive, setShowInactive] = useState(false);
    const [reactivatingId, setReactivatingId] = useState<string | null>(null);

    const activeUsers = users.filter(u => u.is_active);
    const inactiveUsers = users.filter(u => !u.is_active);

    const fetchData = async () => {
        setIsLoading(true);

        // Fetch current user to check if super admin
        const currentUser = await getCurrentUserProfile();
        setIsSuperAdmin(currentUser?.role === 'super_admin');

        // Fetch Invitations
        const invResult = await getInvitations();
        if (invResult.error) toast.error(invResult.error);
        else setInvitations(invResult.invitations || []);

        // Fetch Users (Requires Admin)
        const userResult = await getAllUsers();
        if ('error' in userResult && userResult.error) {
            console.error(userResult.error);
        } else if ('users' in userResult) {
            setUsers(userResult.users || []);
        }

        setIsLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleRevoke = async (id: string) => {
        if (!confirm('Are you sure you want to revoke this invitation?')) return;
        const { error } = await revokeInvitation(id);
        if (error) toast.error(error);
        else {
            toast.success('Invitation revoked');
            fetchData();
        }
    };

    const handleReactivate = async (userId: string) => {
        setReactivatingId(userId);
        try {
            const result = await reactivateUser(userId);
            if (result.error) {
                toast.error(result.error);
            } else {
                toast.success('User reactivated successfully');
                fetchData();
            }
        } catch (error) {
            toast.error('Failed to reactivate user');
        } finally {
            setReactivatingId(null);
        }
    };

    const getStatusBadge = (status: string, expiresAt: string) => {
        if (status === 'accepted') return <Badge className="bg-green-600">Accepted</Badge>;
        if (status === 'pending') {
            if (new Date(expiresAt) < new Date()) return <Badge variant="destructive">Expired</Badge>;
            return <Badge variant="secondary" className="bg-yellow-600/20 text-yellow-500">Pending</Badge>;
        }
        return <Badge variant="outline">{status}</Badge>;
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-medium">Team Members</h3>
                    <p className="text-sm text-muted-foreground">Manage your team, roles, and permissions.</p>
                </div>
                <CreateUserDialog onSuccess={fetchData} isSuperAdmin={isSuperAdmin} />
            </div>

            {/* Active Team List */}
            <Card className="bg-[#121212] border-white/10">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Active Team
                        <Badge variant="secondary" className="ml-2">{activeUsers.length}</Badge>
                    </CardTitle>
                    <CardDescription>Current members with access to the dashboard.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {activeUsers.map((user) => (
                            <div key={user.id} className="border border-white/10 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center space-x-3">
                                        <Avatar className="h-10 w-10">
                                            <AvatarImage src={user.avatar_url || ''} alt={user.name || 'User'} />
                                            <AvatarFallback className="bg-primary/20 text-primary font-bold">
                                                {user.name?.[0] || user.email[0].toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="font-medium">{user.name || 'Unnamed User'}</p>
                                            <p className="text-sm text-muted-foreground">{user.email}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Badge variant="outline" className={`capitalize ${user.role === 'super_admin' ? 'bg-purple-500/20 text-purple-400 border-purple-500/50' :
                                            user.role === 'admin' ? 'bg-amber-500/20 text-amber-400 border-amber-500/50' : ''
                                            }`}>
                                            {user.role === 'super_admin' ? 'Super Admin' :
                                                user.role === 'admin' ? 'Admin' : 'Standard'}
                                        </Badge>
                                        {user.job_title && (
                                            <Badge variant="secondary" className="capitalize bg-cyan-500/20 text-cyan-400">
                                                {user.job_title.replace('_', ' ')}
                                            </Badge>
                                        )}
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setExpandedUser(expandedUser === user.id ? null : user.id)}
                                        >
                                            {expandedUser === user.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                            <span className="ml-2">Permissions</span>
                                        </Button>
                                        <UserEditModal user={user} onUpdate={fetchData} isSuperAdmin={isSuperAdmin} />
                                    </div>
                                </div>

                                {expandedUser === user.id && (
                                    <div className="mt-4 pt-4 border-t border-white/10 animate-in fade-in slide-in-from-top-2">
                                        {user.role === 'super_admin' ? (
                                            <div className="flex items-center text-purple-400 bg-purple-500/10 p-3 rounded-md border border-purple-500/20">
                                                <Shield className="h-5 w-5 mr-2" />
                                                <span className="text-sm font-medium">Super Admins have full access to all features.</span>
                                            </div>
                                        ) : (
                                            <PermissionToggles
                                                userId={user.id}
                                                role={user.role as UserAccess['role']}
                                                initialPermissions={user.permissions || {}}
                                                onUpdate={() => { }}
                                            />
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                        {activeUsers.length === 0 && !isLoading && (
                            <div className="text-center py-8 text-muted-foreground">No active users found.</div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Inactive Users List */}
            {inactiveUsers.length > 0 && (
                <Card className="bg-[#121212] border-white/10 opacity-70">
                    <CardHeader
                        className="cursor-pointer hover:bg-white/5 transition-colors"
                        onClick={() => setShowInactive(!showInactive)}
                    >
                        <CardTitle className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <Users className="h-5 w-5" />
                                Inactive Users
                                <Badge variant="secondary" className="ml-2 bg-red-500/20 text-red-400">{inactiveUsers.length}</Badge>
                            </div>
                            {showInactive ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </CardTitle>
                        <CardDescription>Deactivated users - no longer have system access but history preserved.</CardDescription>
                    </CardHeader>
                    {showInactive && (
                        <CardContent>
                            <div className="space-y-3">
                                {inactiveUsers.map((user) => (
                                    <div key={user.id} className="border border-white/5 rounded-lg p-3 flex items-center justify-between bg-white/5">
                                        <div className="flex items-center space-x-3">
                                            <Avatar className="h-8 w-8">
                                                <AvatarImage src={user.avatar_url || ''} alt={user.name || 'User'} />
                                                <AvatarFallback className="bg-gray-600/20 text-gray-400 text-sm font-bold">
                                                    {user.name?.[0] || user.email[0].toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <p className="font-medium text-muted-foreground">{user.name || 'Unnamed User'}</p>
                                                <p className="text-xs text-muted-foreground/60">{user.email}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {user.job_title && (
                                                <Badge variant="secondary" className="capitalize bg-gray-500/20 text-gray-400 text-xs">
                                                    {user.job_title.replace('_', ' ')}
                                                </Badge>
                                            )}
                                            {isSuperAdmin && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleReactivate(user.id)}
                                                    disabled={reactivatingId === user.id}
                                                    className="text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/10"
                                                >
                                                    <UserCheck className="h-4 w-4 mr-1" />
                                                    {reactivatingId === user.id ? 'Reactivating...' : 'Reactivate'}
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    )}
                </Card>
            )}

            {/* Pending Invitations */}
            <Card className="bg-[#121212] border-white/10 opacity-80 hover:opacity-100 transition-opacity">
                <CardHeader>
                    <CardTitle>Pending Invitations</CardTitle>
                </CardHeader>
                <CardContent>
                    {invitations.length === 0 ? (
                        <div className="text-sm text-muted-foreground">No pending invitations.</div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="border-white/10 hover:bg-transparent">
                                    <TableHead>Email</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {invitations.map((invite) => (
                                    <TableRow key={invite.id} className="border-white/10">
                                        <TableCell>{invite.email}</TableCell>
                                        <TableCell className="capitalize">{invite.role}</TableCell>
                                        <TableCell>{getStatusBadge(invite.status, invite.expires_at)}</TableCell>
                                        <TableCell className="text-right">
                                            {invite.status === 'pending' && (
                                                <Button variant="ghost" size="sm" onClick={() => handleRevoke(invite.id)} className="text-red-500">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div >
    );
}

