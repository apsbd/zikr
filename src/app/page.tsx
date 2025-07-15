'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DeckCard } from '@/components/Dashboard/DeckCard';
import { Deck, DeckDisplayInfo } from '@/types';
import { useDeckDisplay } from '@/hooks/queries';
import { cleanupOldLocalStorageData } from '@/lib/migration';
import ProtectedRoute from '@/components/Auth/ProtectedRoute';
import UserProfile from '@/components/Auth/UserProfile';
import { useAuth } from '@/contexts/auth';

export default function Home() {
    const router = useRouter();
    const { user } = useAuth();
    const { data: displayDecks = [], isLoading, error } = useDeckDisplay();

    useEffect(() => {
        // Clean up old localStorage data on first load
        cleanupOldLocalStorageData();
    }, []);

    useEffect(() => {
        if (error) {
            console.error('Error loading decks:', error);
        }
    }, [error]);

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

                    {isLoading && (
                        <div className='text-center py-12'>
                            <p className='text-muted-foreground'>
                                Loading decks...
                            </p>
                        </div>
                    )}
                    
                    {!isLoading && displayDecks.length === 0 && (
                        <div className='text-center py-12'>
                            <p className='text-muted-foreground'>
                                No decks available
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </ProtectedRoute>
    );
}
