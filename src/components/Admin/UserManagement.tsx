'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Shield, Crown, User } from 'lucide-react';
import { getAllUserProfiles, updateUserRole } from '@/lib/database';
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
                {users.map((user) => (
                    <Card key={user.id}>
                        <CardContent className='p-6'>
                            <div className='flex items-center justify-between'>
                                <div className='flex items-center gap-4'>
                                    {getRoleIcon(user.role)}
                                    <div>
                                        <h3 className='font-medium text-foreground'>{user.email}</h3>
                                        <p className='text-sm text-muted-foreground'>
                                            Created: {new Date(user.created_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                                
                                <div className='flex items-center gap-4'>
                                    <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getRoleBadgeColor(user.role)}`}>
                                        {user.role}
                                    </span>
                                    
                                    {/* Role Change Buttons */}
                                    {user.role !== 'superuser' && (
                                        <div className='flex gap-2'>
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
                ))}
            </div>

            {users.length === 0 && (
                <div className='text-center py-12'>
                    <p className='text-muted-foreground'>No users found</p>
                </div>
            )}
        </div>
    );
}