'use client';

import { useEffect, useState } from 'react';
import { getInvitations, revokeInvitation, Invitation } from '@/lib/actions/invitations';
import { getAllUsers, User, getCurrentUserProfile } from '@/lib/actions/profile';
import { CreateUserDialog } from '@/components/team/CreateUserDialog';
import { UserEditModal } from '@/components/team/UserEditModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { Trash2, Shield, ChevronDown, ChevronUp } from 'lucide-react';
import { PermissionToggles } from './PermissionToggles';

export function TeamSettingsClient() {
    const [invitations, setInvitations] = useState<Invitation[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedUser, setExpandedUser] = useState<string | null>(null);
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);

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
            // Silently fail if not admin or just log? 
            // If unauthorized, we just might not show the user list or show empty.
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
                {isSuperAdmin && <CreateUserDialog onSuccess={fetchData} />}
            </div>

            {/* Active Team List */}
            <Card className="bg-[#121212] border-white/10">
                <CardHeader>
                    <CardTitle>Active Team</CardTitle>
                    <CardDescription>Current members with access to the dashboard.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {users.map((user) => (
                            <div key={user.id} className="border border-white/10 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center space-x-3">
                                        <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                                            {user.name?.[0] || user.email[0].toUpperCase()}
                                        </div>
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
                                        {user.role === 'admin' ? (
                                            <div className="flex items-center text-emerald-500 bg-emerald-500/10 p-3 rounded-md">
                                                <Shield className="h-5 w-5 mr-2" />
                                                <span className="text-sm font-medium">Admins have full access to all features.</span>
                                            </div>
                                        ) : (
                                            <PermissionToggles
                                                userId={user.id}
                                                initialPermissions={user.permissions || {}}
                                                onUpdate={() => { }} // Optional: refresh list if needed, but local state handles UI
                                            />
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                        {users.length === 0 && !isLoading && (
                            <div className="text-center py-8 text-muted-foreground">No active users found.</div>
                        )}
                    </div>
                </CardContent>
            </Card>

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
