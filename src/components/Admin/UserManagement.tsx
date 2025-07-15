'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Shield, Crown, User, Ban, UserCheck } from 'lucide-react';
import { getAllUserProfiles, updateUserRole, updateUserBanStatus, debugGetAllUserProfiles } from '@/lib/database';
import type { Database } from '@/types/database';

type UserProfile = Database['public']['Tables']['user_profiles']['Row'];

export default function UserManagement() {
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState<string | null>(null);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const loadUsers = async () => {
        try {
            setLoading(true);
            
            // Run debug function for logging
            const debugResult = await debugGetAllUserProfiles();
            
            const userProfiles = await getAllUserProfiles();
            setUsers(userProfiles);
        } catch (error) {
            console.error('Error loading users:', error);
            setMessage({ type: 'error', text: 'Failed to load users' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadUsers();
    }, []);

    const handleRoleChange = async (userId: string, newRole: 'user' | 'admin' | 'superuser') => {
        try {
            setUpdating(userId);
            setMessage(null);

            const success = await updateUserRole(userId, newRole);
            
            if (success) {
                setMessage({ type: 'success', text: `User role updated to ${newRole}` });
                await loadUsers(); // Refresh the list
                
                // Auto-clear success message after 3 seconds
                setTimeout(() => setMessage(null), 3000);
            } else {
                setMessage({ type: 'error', text: 'Failed to update user role' });
            }
        } catch (error) {
            console.error('Error updating user role:', error);
            setMessage({ type: 'error', text: 'Failed to update user role' });
        } finally {
            setUpdating(null);
        }
    };

    const handleBanStatusChange = async (userId: string, isBanned: boolean) => {
        try {
            setUpdating(userId);
            setMessage(null);

            const success = await updateUserBanStatus(userId, isBanned);
            
            if (success) {
                setMessage({ 
                    type: 'success', 
                    text: `User ${isBanned ? 'banned' : 'unbanned'} successfully` 
                });
                await loadUsers(); // Refresh the list
                
                // Auto-clear success message after 3 seconds
                setTimeout(() => setMessage(null), 3000);
            } else {
                setMessage({ type: 'error', text: `Failed to ${isBanned ? 'ban' : 'unban'} user` });
            }
        } catch (error) {
            console.error('Error updating user ban status:', error);
            setMessage({ type: 'error', text: `Failed to ${isBanned ? 'ban' : 'unban'} user` });
        } finally {
            setUpdating(null);
        }
    };


    const getRoleIcon = (role: string) => {
        switch (role) {
            case 'superuser':
                return <Crown className='w-4 h-4 text-yellow-500' />;
            case 'admin':
                return <Shield className='w-4 h-4 text-blue-500' />;
            default:
                return <User className='w-4 h-4 text-gray-500' />;
        }
    };

    const getRoleBadgeColor = (role: string) => {
        switch (role) {
            case 'superuser':
                return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'admin':
                return 'bg-blue-100 text-blue-800 border-blue-200';
            default:
                return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    if (loading) {
        return (
            <div className='flex items-center justify-center py-12'>
                <div className='text-muted-foreground'>Loading users...</div>
            </div>
        );
    }

    return (
        <div className='space-y-6'>
            <div className='flex items-center gap-3'>
                <Users className='w-6 h-6' />
                <h2 className='text-2xl font-bold'>User Management</h2>
            </div>

            {/* Status Message */}
            {message && (
                <div className={`p-4 rounded-lg border ${
                    message.type === 'success' 
                        ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400' 
                        : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400'
                }`}>
                    {message.text}
                </div>
            )}

            {/* Users List */}
            <div className='space-y-4'>
                {users.map((user) => {
                    const isBanned = user.is_banned || false; // Handle missing field
                    return (
                        <Card key={user.id} className={isBanned ? 'border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-900/10' : ''}>
                            <CardContent className='p-6'>
                                <div className='flex items-center justify-between'>
                                    <div className='flex items-center gap-4'>
                                        {getRoleIcon(user.role)}
                                        <div>
                                            <div className='flex items-center gap-2'>
                                                <h3 className={`font-medium ${isBanned ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}>
                                                    {user.email}
                                                </h3>
                                                {isBanned && (
                                                    <span className='px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded-full border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'>
                                                        BANNED
                                                    </span>
                                                )}
                                            </div>
                                            <p className='text-sm text-muted-foreground'>
                                                Created: {new Date(user.created_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                
                                <div className='flex items-center gap-4'>
                                    <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getRoleBadgeColor(user.role)}`}>
                                        {user.role}
                                    </span>
                                    
                                    {/* Role Change and Ban Buttons */}
                                    {user.role !== 'superuser' && (
                                        <div className='flex gap-2 flex-wrap'>
                                            {/* Role Change Buttons */}
                                            {!isBanned && (
                                                <>
                                                    {user.role !== 'admin' && (
                                                        <Button
                                                            size='sm'
                                                            variant='outline'
                                                            onClick={() => handleRoleChange(user.user_id, 'admin')}
                                                            disabled={updating === user.user_id}
                                                        >
                                                            {updating === user.user_id ? 'Updating...' : 'Make Admin'}
                                                        </Button>
                                                    )}
                                                    {user.role !== 'user' && (
                                                        <Button
                                                            size='sm'
                                                            variant='outline'
                                                            onClick={() => handleRoleChange(user.user_id, 'user')}
                                                            disabled={updating === user.user_id}
                                                        >
                                                            {updating === user.user_id ? 'Updating...' : 'Make User'}
                                                        </Button>
                                                    )}
                                                </>
                                            )}
                                            
                                            {/* Ban/Unban Button */}
                                            <Button
                                                size='sm'
                                                variant={isBanned ? 'default' : 'destructive'}
                                                onClick={() => handleBanStatusChange(user.user_id, !isBanned)}
                                                disabled={updating === user.user_id}
                                            >
                                                {updating === user.user_id ? (
                                                    'Updating...'
                                                ) : isBanned ? (
                                                    <>
                                                        <UserCheck className='w-4 h-4 mr-1' />
                                                        Unban
                                                    </>
                                                ) : (
                                                    <>
                                                        <Ban className='w-4 h-4 mr-1' />
                                                        Ban
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    )}
                                    
                                    {user.role === 'superuser' && (
                                        <span className='text-sm text-muted-foreground'>
                                            Cannot modify superuser
                                        </span>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    );
                })}
            </div>

            {users.length === 0 && (
                <div className='text-center py-12'>
                    <p className='text-muted-foreground'>No users found</p>
                </div>
            )}
            
            {users.length === 1 && (
                <div className='text-center py-8'>
                    <Card className='max-w-md mx-auto'>
                        <CardContent className='p-6'>
                            <div className='space-y-4'>
                                <div className='text-center'>
                                    <Users className='w-12 h-12 mx-auto text-muted-foreground mb-4' />
                                    <h3 className='text-lg font-semibold'>Only One User Profile</h3>
                                    <p className='text-sm text-muted-foreground'>
                                        Currently, only your profile exists in the system. 
                                        User profiles are automatically created when users sign up.
                                    </p>
                                </div>
                                <div className='text-xs text-muted-foreground space-y-2'>
                                    <p>• New users who sign up will automatically appear here</p>
                                    <p>• Profiles are created instantly when users register</p>
                                    <p>• This is normal for a new application with one user</p>
                                    <p>• Check browser console for technical details</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}