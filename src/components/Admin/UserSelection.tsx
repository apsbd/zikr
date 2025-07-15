'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
    Search, 
    Users, 
    Check, 
    X, 
    ChevronLeft, 
    ChevronRight, 
    User, 
    Shield, 
    Crown 
} from 'lucide-react';
import { 
    getUsersForDeckAccess, 
    grantDeckAccess, 
    revokeDeckAccess 
} from '@/lib/database';
import type { UserSelectionItem } from '@/types';

interface UserSelectionProps {
    deckId: string;
    currentUserId: string;
    onClose: () => void;
}

export default function UserSelection({ deckId, currentUserId, onClose }: UserSelectionProps) {
    const [users, setUsers] = useState<UserSelectionItem[]>([]);
    const [search, setSearch] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalUsers, setTotalUsers] = useState(0);
    const [loading, setLoading] = useState(false);
    const [updatingUser, setUpdatingUser] = useState<string | null>(null);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    
    const pageSize = 10;
    const totalPages = Math.ceil(totalUsers / pageSize);

    const loadUsers = async () => {
        setLoading(true);
        try {
            const result = await getUsersForDeckAccess(deckId, search, currentPage, pageSize);
            setUsers(result.users);
            setTotalUsers(result.total);
        } catch (error) {
            console.error('Error loading users:', error);
            setMessage({ type: 'error', text: 'Failed to load users' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadUsers();
    }, [deckId, search, currentPage]);

    const handleAccessToggle = async (userId: string, currentAccess: boolean) => {
        setUpdatingUser(userId);
        setMessage(null);

        try {
            const success = currentAccess 
                ? await revokeDeckAccess(deckId, userId)
                : await grantDeckAccess(deckId, userId, currentUserId);

            if (success) {
                setMessage({ 
                    type: 'success', 
                    text: `User access ${currentAccess ? 'revoked' : 'granted'} successfully` 
                });
                setTimeout(() => setMessage(null), 3000);
                await loadUsers(); // Refresh the list
            } else {
                setMessage({ 
                    type: 'error', 
                    text: `Failed to ${currentAccess ? 'revoke' : 'grant'} access` 
                });
            }
        } catch (error) {
            console.error('Error updating user access:', error);
            setMessage({ 
                type: 'error', 
                text: `Failed to ${currentAccess ? 'revoke' : 'grant'} access` 
            });
        } finally {
            setUpdatingUser(null);
        }
    };

    const handleSearchChange = (value: string) => {
        setSearch(value);
        setCurrentPage(1); // Reset to first page when searching
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

    return (
        <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4'>
            <Card className='w-full max-w-4xl max-h-[90vh] overflow-hidden'>
                <CardHeader className='border-b'>
                    <div className='flex items-center justify-between'>
                        <div className='flex items-center gap-3'>
                            <Users className='w-6 h-6' />
                            <CardTitle>Manage Deck Access</CardTitle>
                        </div>
                        <Button onClick={onClose} variant='outline' size='sm'>
                            <X className='w-4 h-4' />
                        </Button>
                    </div>
                    <p className='text-sm text-muted-foreground'>
                        Select which users can access this deck
                    </p>
                </CardHeader>

                <CardContent className='p-6'>
                    {/* Search Bar */}
                    <div className='relative mb-6'>
                        <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4' />
                        <input
                            type='text'
                            placeholder='Search users by email...'
                            value={search}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            className='w-full pl-10 pr-4 py-2 bg-input border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent'
                        />
                    </div>

                    {/* Status Message */}
                    {message && (
                        <div className={`mb-4 p-3 rounded-lg border ${
                            message.type === 'success' 
                                ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400' 
                                : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400'
                        }`}>
                            {message.text}
                        </div>
                    )}

                    {/* Users List */}
                    <div className='space-y-3 max-h-96 overflow-y-auto'>
                        {loading ? (
                            <div className='flex items-center justify-center py-8'>
                                <div className='text-muted-foreground'>Loading users...</div>
                            </div>
                        ) : users.length === 0 ? (
                            <div className='text-center py-8'>
                                <p className='text-muted-foreground'>
                                    {search ? 'No users found matching your search' : 'No users found'}
                                </p>
                            </div>
                        ) : (
                            users.map((user) => (
                                <div 
                                    key={user.id} 
                                    className='flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors'
                                >
                                    <div className='flex items-center gap-3'>
                                        {getRoleIcon(user.role)}
                                        <div>
                                            <div className='flex items-center gap-2'>
                                                <span className='font-medium'>{user.email}</span>
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getRoleBadgeColor(user.role)}`}>
                                                    {user.role}
                                                </span>
                                            </div>
                                            <p className='text-sm text-muted-foreground'>
                                                Joined: {new Date(user.createdAt).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>

                                    <div className='flex items-center gap-2'>
                                        {user.hasAccess ? (
                                            <div className='flex items-center gap-2 text-green-600'>
                                                <Check className='w-4 h-4' />
                                                <span className='text-sm font-medium'>Has Access</span>
                                            </div>
                                        ) : (
                                            <div className='flex items-center gap-2 text-muted-foreground'>
                                                <X className='w-4 h-4' />
                                                <span className='text-sm'>No Access</span>
                                            </div>
                                        )}
                                        
                                        <Button
                                            onClick={() => handleAccessToggle(user.userId, user.hasAccess)}
                                            disabled={updatingUser === user.userId}
                                            variant={user.hasAccess ? 'destructive' : 'default'}
                                            size='sm'
                                        >
                                            {updatingUser === user.userId ? (
                                                'Updating...'
                                            ) : user.hasAccess ? (
                                                'Revoke Access'
                                            ) : (
                                                'Grant Access'
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className='flex items-center justify-between mt-6 pt-4 border-t'>
                            <div className='text-sm text-muted-foreground'>
                                Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalUsers)} of {totalUsers} users
                            </div>
                            <div className='flex items-center gap-2'>
                                <Button
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={currentPage === 1}
                                    variant='outline'
                                    size='sm'
                                >
                                    <ChevronLeft className='w-4 h-4' />
                                </Button>
                                <span className='text-sm'>
                                    Page {currentPage} of {totalPages}
                                </span>
                                <Button
                                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                    disabled={currentPage === totalPages}
                                    variant='outline'
                                    size='sm'
                                >
                                    <ChevronRight className='w-4 h-4' />
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}