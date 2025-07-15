'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DeckCard } from '@/components/Dashboard/DeckCard';
import { Deck, DeckDisplayInfo } from '@/types';
import { getDecks, getDeckDisplayInfo } from '@/lib/database';
import { cleanupOldLocalStorageData } from '@/lib/migration';
import ProtectedRoute from '@/components/Auth/ProtectedRoute';
import UserProfile from '@/components/Auth/UserProfile';
import { useAuth } from '@/contexts/auth';

export default function Home() {
    const [decks, setDecks] = useState<Deck[]>([]);
    const [displayDecks, setDisplayDecks] = useState<DeckDisplayInfo[]>([]);
    const [lastUpdate, setLastUpdate] = useState(Date.now());
    const router = useRouter();
    const { user } = useAuth();

    const loadDecks = async () => {
        try {
            const savedDecks = await getDecks(user?.id);
            setDecks(savedDecks);
            const displayInfo = savedDecks.map((deck) =>
                getDeckDisplayInfo(deck)
            );
            setDisplayDecks(displayInfo);
            setLastUpdate(Date.now());
        } catch (error) {
            console.error('Error loading decks:', error);
        }
    };

    useEffect(() => {
        // Clean up old localStorage data on first load
        cleanupOldLocalStorageData();
    }, []);

    // Load decks when user is available
    useEffect(() => {
        if (user) {
            loadDecks();
        }
    }, [user]);

    // Auto-refresh mechanism
    useEffect(() => {
        if (user) {
            const interval = setInterval(() => {
                loadDecks();
            }, 60000); // Check every minute

            return () => clearInterval(interval);
        }
    }, [user]);

    const handleStudy = (deckId: string) => {
        router.push(`/study/${deckId}`);
    };

    return (
        <ProtectedRoute>
            <div className='min-h-screen bg-background'>
                <UserProfile />

                <div className='w-full sm:max-w-4xl sm:mx-auto py-8 px-2 sm:px-4 lg:px-8'>
                    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6'>
                        {displayDecks.map((deck) => (
                            <DeckCard
                                key={deck.id}
                                deck={deck}
                                onStudy={handleStudy}
                            />
                        ))}
                    </div>

                    {displayDecks.length === 0 && (
                        <div className='text-center py-12'>
                            <p className='text-muted-foreground'>
                                Loading decks...
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </ProtectedRoute>
    );
}
