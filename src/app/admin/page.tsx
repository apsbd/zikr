'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Deck } from '@/types';
import { getDecks, saveDeck, deleteDeck, initializeUserProfile, isUserAdmin, isUserSuperuser } from '@/lib/database';
import { testDatabaseConnection } from '@/lib/test-db';
import { initializeFSRSCard, getCardStats } from '@/lib/fsrs';
import { BookOpen, Plus, Edit, Trash2, Users, Settings } from 'lucide-react';
import ProtectedRoute from '@/components/Auth/ProtectedRoute';
import UserProfile from '@/components/Auth/UserProfile';
import UserManagement from '@/components/Admin/UserManagement';
import { useAuth } from '@/contexts/auth';

export default function AdminPanel() {
    const [decks, setDecks] = useState<Deck[]>([]);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isSuperuser, setIsSuperuser] = useState(false);
    const [activeTab, setActiveTab] = useState<'decks' | 'users'>('decks');
    const { user, loading } = useAuth();

    const loadDecks = async () => {
        try {
            // Admin should see all decks without user filtering
            const savedDecks = await getDecks();
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
                console.log('Checking user role for:', user.email, 'User ID:', user.id);
                
                // Test database connection first
                const dbTest = await testDatabaseConnection();
                console.log('Database test result:', dbTest);
                
                // Initialize user profile if it doesn't exist
                const profile = await initializeUserProfile(user.id, user.email || '');
                console.log('User profile:', profile);
                
                // Check if user has admin privileges
                const adminStatus = await isUserAdmin(user.id);
                const superuserStatus = await isUserSuperuser(user.id);
                
                console.log('Admin status:', adminStatus, 'Superuser status:', superuserStatus);
                
                setIsAuthenticated(adminStatus);
                setIsSuperuser(superuserStatus);
            } catch (error) {
                console.error('Error checking user role:', error);
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
            cards: [],
            stats: { total: 0, new: 0, learning: 0, review: 0 },
            createdAt: new Date(),
            updatedAt: new Date(),
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
            <div className='min-h-screen bg-background p-4'>
                <div className='max-w-6xl mx-auto'>
                    <div className="mb-6">
                        <UserProfile />
                    </div>
                    
                    <header className='mb-8'>
                        <div>
                            <h1 className='text-3xl font-bold mb-2'>
                                Admin Panel
                            </h1>
                            <p className='text-muted-foreground'>Manage decks, cards, and users</p>
                        </div>
                    </header>

                    {/* Tab Navigation */}
                    <div className='mb-8'>
                        <div className='flex space-x-1 bg-muted p-1 rounded-lg w-fit'>
                            <button
                                onClick={() => setActiveTab('decks')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                                    activeTab === 'decks' 
                                        ? 'bg-background text-foreground shadow-sm' 
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
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
                                    }`}
                                >
                                    <Users className='w-4 h-4' />
                                    Users
                                </button>
                            )}
                        </div>
                    </div>

                {/* Tab Content */}
                {activeTab === 'decks' && (
                    <div>
                        <div className='mb-6'>
                            <Button
                                onClick={handleCreateDeck}>
                                <Plus className='w-4 h-4 mr-2' />
                                Create New Deck
                            </Button>
                        </div>

                        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
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
                                            <p>Cards: {deck.stats.total}</p>
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
                                                    handleDeleteDeck(deck.id)
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
                                    No decks found. Create your first deck!
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'users' && isSuperuser && (
                    <UserManagement />
                )}
                </div>
            </div>
        </ProtectedRoute>
    );
}
