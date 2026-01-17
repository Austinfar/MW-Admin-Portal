'use client';

import { useEffect, useState } from 'react';
import { getInvitations, revokeInvitation, Invitation } from '@/lib/actions/invitations';
import { InviteMemberDialog } from '@/components/team/InviteMemberDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';

export function TeamSettingsClient() {
    const [invitations, setInvitations] = useState<Invitation[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchInvitations = async () => {
        setIsLoading(true);
        const { invitations, error } = await getInvitations();
        if (error) {
            toast.error(error);
        } else {
            setInvitations(invitations || []);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchInvitations();
    }, []);

    const handleRevoke = async (id: string) => {
        const confirm = window.confirm('Are you sure you want to revoke this invitation?');
        if (!confirm) return;

        const { error } = await revokeInvitation(id);
        if (error) {
            toast.error(error);
        } else {
            toast.success('Invitation revoked');
            fetchInvitations(); // Refresh list
        }
    };

    // Helper to format status badges
    const getStatusBadge = (status: string, expiresAt: string) => {
        if (status === 'accepted') return <Badge className="bg-green-600">Accepted</Badge>;
        if (status === 'pending') {
            if (new Date(expiresAt) < new Date()) {
                return <Badge variant="destructive">Expired</Badge>;
            }
            return <Badge variant="secondary" className="bg-yellow-600/20 text-yellow-500">Pending</Badge>;
        }
        return <Badge variant="outline">{status}</Badge>;
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-medium">Team Members</h3>
                    <p className="text-sm text-muted-foreground">
                        Manage your team, roles, and pending invitations.
                    </p>
                </div>
                <InviteMemberDialog />
            </div>

            <Card className="bg-[#121212] border-white/10">
                <CardHeader>
                    <CardTitle>Pending Invitations</CardTitle>
                    <CardDescription>
                        Invitations sent to potential team members.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="text-sm text-gray-500">Loading invitations...</div>
                    ) : invitations.length === 0 ? (
                        <div className="text-sm text-gray-500">No pending invitations found.</div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="border-white/10 hover:bg-transparent">
                                    <TableHead>Email</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Expires</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {invitations.map((invite) => (
                                    <TableRow key={invite.id} className="border-white/10">
                                        <TableCell className="font-medium">{invite.email}</TableCell>
                                        <TableCell className="capitalize">{invite.role}</TableCell>
                                        <TableCell>{getStatusBadge(invite.status, invite.expires_at)}</TableCell>
                                        <TableCell className="text-muted-foreground text-xs">
                                            {formatDistanceToNow(new Date(invite.expires_at), { addSuffix: true })}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {invite.status === 'pending' && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleRevoke(invite.id)}
                                                    className="text-red-500 hover:text-red-400 hover:bg-red-950/20"
                                                >
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

            {/* Placeholder for Active Team List - could fetch from profiles table later */}
            <Card className="bg-[#121212] border-white/10 opacity-50">
                <CardHeader>
                    <CardTitle>Active Team</CardTitle>
                    <CardDescription>
                        Current members with access to the dashboard.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">Team list implementation coming next.</p>
                </CardContent>
            </Card>
        </div>
    );
}
