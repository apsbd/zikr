'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Deck } from '@/types';
import {
    getDecks,
    saveDeck,
    deleteDeck,
    initializeUserProfile,
    isUserAdmin,
    isUserSuperuser
} from '@/lib/database';
import { testDatabaseConnection } from '@/lib/test-db';
import { initializeFSRSCard, getCardStats } from '@/lib/fsrs';
import { BookOpen, Plus, Edit, Trash2, Users, Settings, Copy, Check } from 'lucide-react';
import ProtectedRoute from '@/components/Auth/ProtectedRoute';
import UserProfile from '@/components/Auth/UserProfile';
import UserManagement from '@/components/Admin/UserManagement';
import { useAuth } from '@/contexts/auth';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function AdminPanel() {
    const [decks, setDecks] = useState<Deck[]>([]);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isSuperuser, setIsSuperuser] = useState(false);
    const [activeTab, setActiveTab] = useState<'decks' | 'users'>('decks');
    const [debugLogs, setDebugLogs] = useState<string[]>([]);
    const [showDebugPanel, setShowDebugPanel] = useState(false);
    const [copiedLogs, setCopiedLogs] = useState(false);
    const { user, loading } = useAuth();

    // Debug logging function
    const addDebugLog = (message: string, data?: any) => {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = data 
            ? `[${timestamp}] ${message}: ${JSON.stringify(data, null, 2)}`
            : `[${timestamp}] ${message}`;
        
        setDebugLogs(prev => [...prev, logEntry]);
        console.log(message, data); // Still log to console too
    };

    // Copy debug logs to clipboard
    const copyLogsToClipboard = async () => {
        try {
            const allLogs = debugLogs.join('\n\n');
            const currentState = `
Current State:
- User Email: ${user?.email || 'Not available'}
- User ID: ${user?.id || 'Not available'}
- Is Authenticated: ${isAuthenticated ? 'Yes' : 'No'}
- Is Superuser: ${isSuperuser ? 'Yes' : 'No'}
- Loading: ${loading ? 'Yes' : 'No'}

Debug Logs:
${allLogs}
            `.trim();
            
            await navigator.clipboard.writeText(currentState);
            setCopiedLogs(true);
            setTimeout(() => setCopiedLogs(false), 2000);
        } catch (error) {
            console.error('Failed to copy logs:', error);
        }
    };

    const loadDecks = async () => {
        try {
            // Admin should see all decks without user filtering
            const savedDecks = await getDecks(user?.id);
            setDecks(savedDecks);
        } catch (error) {
            console.error('Error loading decks:', error);
        }
    };

    useEffect(() => {
        // Wait for auth to load before checking
        if (loading || !user) return;

        const checkUserRole = async () => {
            try {
                addDebugLog('Checking user role for', {
                    email: user.email,
                    userId: user.id
                });

                // Test database connection first
                const dbTest = await testDatabaseConnection();
                addDebugLog('Database test result', dbTest);

                // Initialize user profile if it doesn't exist
                const profile = await initializeUserProfile(
                    user.id,
                    user.email || ''
                );
                addDebugLog('User profile', profile);

                // Check if user has admin privileges
                const adminStatus = await isUserAdmin(user.id);
                const superuserStatus = await isUserSuperuser(user.id);

                addDebugLog('Role check results', {
                    adminStatus,
                    superuserStatus
                });

                setIsAuthenticated(adminStatus);
                setIsSuperuser(superuserStatus);
            } catch (error) {
                addDebugLog('Error checking user role', error);
            }
        };

        checkUserRole();
    }, [user, loading]);

    useEffect(() => {
        if (isAuthenticated) {
            loadDecks();
        }
    }, [isAuthenticated]);

    const handleCreateDeck = async () => {
        const newDeck: Deck = {
            id: crypto.randomUUID(),
            title: 'New Deck',
            description: 'A new deck for studying',
            author: 'Admin',
            dailyNewLimit: 20,
            groupAccessEnabled: false,
            isPublic: true,
            cards: [],
            stats: { total: 0, new: 0, learning: 0, review: 0 },
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const success = await saveDeck(newDeck);
        if (success) {
            loadDecks();
        } else {
            alert('Error creating deck. Please try again.');
        }
    };

    const handleDeleteDeck = async (deckId: string) => {
        if (confirm('Are you sure you want to delete this deck?')) {
            const success = await deleteDeck(deckId);
            if (success) {
                loadDecks();
            } else {
                alert('Error deleting deck. Please try again.');
            }
        }
    };

    if (loading) {
        return (
            <div className='min-h-screen bg-background flex items-center justify-center p-4'>
                <div className='text-muted-foreground'>Loading...</div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return (
            <div className='min-h-screen bg-background flex items-center justify-center p-4'>
                <Card className='w-full max-w-md'>
                    <CardHeader>
                        <CardTitle className='text-center'>
                            Admin Access
                        </CardTitle>
                    </CardHeader>
                    <CardContent className='space-y-4 text-center'>
                        <p className='text-muted-foreground'>
                            Access restricted to authorized administrators only.
                        </p>
                        <p className='text-sm text-muted-foreground'>
                            Please sign in with your admin account to continue.
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <ProtectedRoute>
            <div className='min-h-screen bg-background'>
                <UserProfile />
                <ScrollArea
                    className='h-screen w-full'
                    style={{ height: 'calc(100vh - 80px )' }}>
                    <div className='w-full sm:max-w-6xl sm:mx-auto p-2 sm:p-4'>
                        <div className='mb-8'>
                            <h1 className='text-3xl font-bold mb-2'>
                                Admin Panel
                            </h1>
                            <p className='text-muted-foreground'>
                                Manage decks, cards, and users
                            </p>
                        </div>

                        {/* Tab Navigation */}
                        <div className='mb-8'>
                            <div className='flex space-x-1 bg-muted p-1 rounded-lg w-fit'>
                                <button
                                    onClick={() => setActiveTab('decks')}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                                        activeTab === 'decks'
                                            ? 'bg-background text-foreground shadow-sm'
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}>
                                    <BookOpen className='w-4 h-4' />
                                    Decks
                                </button>
                                {isSuperuser && (
                                    <button
                                        onClick={() => setActiveTab('users')}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                                            activeTab === 'users'
                                                ? 'bg-background text-foreground shadow-sm'
                                                : 'text-muted-foreground hover:text-foreground'
                                        }`}>
                                        <Users className='w-4 h-4' />
                                        Users
                                    </button>
                                )}
                                {isSuperuser && (
                                    <button
                                        onClick={() => setShowDebugPanel(true)}
                                        className='flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors text-muted-foreground hover:text-foreground'
                                    >
                                        <Settings className='w-4 h-4' />
                                        Debug
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Tab Content */}
                        {activeTab === 'decks' && (
                            <div>
                                <div className='mb-6'>
                                    <Button onClick={handleCreateDeck}>
                                        <Plus className='w-4 h-4 mr-2' />
                                        Create New Deck
                                    </Button>
                                </div>

                                <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6'>
                                    {decks.map((deck) => (
                                        <Card key={deck.id}>
                                            <CardHeader>
                                                <CardTitle className='flex items-center gap-2'>
                                                    <BookOpen className='w-5 h-5' />
                                                    {deck.title}
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className='space-y-4'>
                                                <div className='text-sm text-muted-foreground'>
                                                    <p>
                                                        Cards:{' '}
                                                        {deck.stats.total}
                                                    </p>
                                                    <p>Author: {deck.author}</p>
                                                    <p>
                                                        Created:{' '}
                                                        {new Date(
                                                            deck.createdAt
                                                        ).toLocaleDateString()}
                                                    </p>
                                                </div>

                                                <div className='flex gap-2'>
                                                    <Button
                                                        size='sm'
                                                        variant='outline'
                                                        onClick={() =>
                                                            (window.location.href = `/admin/edit/${deck.id}`)
                                                        }
                                                        className='flex-1'>
                                                        <Edit className='w-4 h-4 mr-1' />
                                                        Edit
                                                    </Button>
                                                    <Button
                                                        size='sm'
                                                        variant='destructive'
                                                        onClick={() =>
                                                            handleDeleteDeck(
                                                                deck.id
                                                            )
                                                        }
                                                        className='flex-1'>
                                                        <Trash2 className='w-4 h-4 mr-1' />
                                                        Delete
                                                    </Button>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>

                                {decks.length === 0 && (
                                    <div className='text-center py-12'>
                                        <p className='text-muted-foreground'>
                                            No decks found. Create your first
                                            deck!
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'users' && isSuperuser && (
                            <UserManagement />
                        )}
                    </div>
                </ScrollArea>

                {/* Debug Panel Overlay */}
                {showDebugPanel && (
                    <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4'>
                        <div className='bg-background border rounded-lg shadow-lg max-w-4xl w-full max-h-[90vh] overflow-hidden'>
                            <div className='flex items-center justify-between p-4 border-b'>
                                <div className='flex items-center gap-3'>
                                    <Settings className='w-6 h-6' />
                                    <h2 className='text-2xl font-bold'>Debug Panel</h2>
                                </div>
                                <div className='flex items-center gap-2'>
                                    <Button
                                        onClick={copyLogsToClipboard}
                                        variant='outline'
                                        size='sm'
                                        disabled={copiedLogs}
                                    >
                                        {copiedLogs ? (
                                            <>
                                                <Check className='w-4 h-4 mr-1' />
                                                Copied!
                                            </>
                                        ) : (
                                            <>
                                                <Copy className='w-4 h-4 mr-1' />
                                                Copy Logs
                                            </>
                                        )}
                                    </Button>
                                    <Button
                                        onClick={() => setDebugLogs([])}
                                        variant='outline'
                                        size='sm'
                                    >
                                        Clear Logs
                                    </Button>
                                    <Button
                                        onClick={() => setShowDebugPanel(false)}
                                        variant='outline'
                                        size='sm'
                                    >
                                        Close
                                    </Button>
                                </div>
                            </div>
                            
                            <div className='p-4 overflow-y-auto max-h-[calc(90vh-80px)]'>
                                <div className='space-y-6'>
                                    <Card>
                                        <CardHeader>
                                            <CardTitle>Current State</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className='space-y-4'>
                                                <div className='grid grid-cols-2 gap-4'>
                                                    <div>
                                                        <label className='text-sm font-medium'>User Email:</label>
                                                        <p className='text-sm text-muted-foreground'>{user?.email || 'Not available'}</p>
                                                    </div>
                                                    <div>
                                                        <label className='text-sm font-medium'>User ID:</label>
                                                        <p className='text-sm text-muted-foreground font-mono'>{user?.id || 'Not available'}</p>
                                                    </div>
                                                    <div>
                                                        <label className='text-sm font-medium'>Is Authenticated:</label>
                                                        <p className={`text-sm font-medium ${isAuthenticated ? 'text-green-600' : 'text-red-600'}`}>
                                                            {isAuthenticated ? 'Yes' : 'No'}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <label className='text-sm font-medium'>Is Superuser:</label>
                                                        <p className={`text-sm font-medium ${isSuperuser ? 'text-green-600' : 'text-red-600'}`}>
                                                            {isSuperuser ? 'Yes' : 'No'}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className='text-sm font-medium'>Loading:</label>
                                                    <p className='text-sm text-muted-foreground'>{loading ? 'Yes' : 'No'}</p>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader>
                                            <CardTitle>Authentication Debug Logs</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className='space-y-2 max-h-96 overflow-y-auto'>
                                                {debugLogs.length === 0 ? (
                                                    <p className='text-muted-foreground text-sm'>
                                                        No debug logs yet. Try refreshing the page or triggering an action.
                                                    </p>
                                                ) : (
                                                    debugLogs.map((log, index) => (
                                                        <div
                                                            key={index}
                                                            className='p-3 bg-muted/50 rounded-md font-mono text-xs whitespace-pre-wrap break-all'
                                                        >
                                                            {log}
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </ProtectedRoute>
    );
}
