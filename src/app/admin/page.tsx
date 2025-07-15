'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Deck } from '@/types';
import { getDecks, saveDeck, deleteDeck } from '@/lib/database';
import { initializeFSRSCard, getCardStats } from '@/lib/fsrs';
import { BookOpen, Plus, Edit, Trash2, LogOut } from 'lucide-react';
import ProtectedRoute from '@/components/Auth/ProtectedRoute';
import UserProfile from '@/components/Auth/UserProfile';
import { useAuth } from '@/contexts/auth';

export default function AdminPanel() {
    const [decks, setDecks] = useState<Deck[]>([]);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');
    const { user } = useAuth();

    const loadDecks = async () => {
        try {
            const savedDecks = await getDecks(user?.id);
            setDecks(savedDecks);
        } catch (error) {
            console.error('Error loading decks:', error);
        }
    };

    useEffect(() => {
        // Check if user is already logged in
        const adminAuth = localStorage.getItem('zikr-admin-auth');
        if (adminAuth === 'authenticated') {
            setIsAuthenticated(true);
        }
    }, []);

    useEffect(() => {
        if (isAuthenticated) {
            loadDecks();
        }
    }, [isAuthenticated]);

    const handleAuth = () => {
        // Simple password protection for MVP
        if (password === 'A63in360!') {
            setIsAuthenticated(true);
            localStorage.setItem('zikr-admin-auth', 'authenticated');
        } else {
            alert('Invalid password');
        }
    };

    const handleLogout = () => {
        setIsAuthenticated(false);
        setPassword('');
        localStorage.removeItem('zikr-admin-auth');
    };

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

    if (!isAuthenticated) {
        return (
            <div className='min-h-screen bg-gray-900 flex items-center justify-center p-4'>
                <Card className='w-full max-w-md bg-gray-800 border-gray-700'>
                    <CardHeader>
                        <CardTitle className='text-white text-center'>
                            Admin Login
                        </CardTitle>
                    </CardHeader>
                    <CardContent className='space-y-4'>
                        <input
                            type='password'
                            placeholder='Enter admin password'
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className='w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400'
                            onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
                        />
                        <Button
                            onClick={handleAuth}
                            className='w-full bg-blue-600 hover:bg-blue-700'>
                            Login
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <ProtectedRoute>
            <div className='min-h-screen bg-gray-900 p-4'>
                <div className='max-w-6xl mx-auto'>
                    <div className="mb-6">
                        <UserProfile />
                    </div>
                    
                    <header className='mb-8 flex justify-between items-start'>
                        <div>
                            <h1 className='text-3xl font-bold text-white mb-2'>
                                Admin Panel
                            </h1>
                            <p className='text-gray-300'>Manage decks and cards</p>
                        </div>
                        <Button
                            onClick={handleLogout}
                            variant='outline'
                            className='border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white'>
                            <LogOut className='w-4 h-4 mr-2' />
                            Logout
                        </Button>
                    </header>

                <div className='mb-6'>
                    <Button
                        onClick={handleCreateDeck}
                        className='bg-green-600 hover:bg-green-700'>
                        <Plus className='w-4 h-4 mr-2' />
                        Create New Deck
                    </Button>
                </div>

                <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
                    {decks.map((deck) => (
                        <Card
                            key={deck.id}
                            className='bg-gray-800 border-gray-700'>
                            <CardHeader>
                                <CardTitle className='flex items-center gap-2 text-white'>
                                    <BookOpen className='w-5 h-5' />
                                    {deck.title}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className='space-y-4'>
                                <div className='text-sm text-gray-300'>
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
                                        className='flex-1 border-gray-600 text-gray-300'>
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
                        <p className='text-gray-400'>
                            No decks found. Create your first deck!
                        </p>
                    </div>
                )}
                </div>
            </div>
        </ProtectedRoute>
    );
}
