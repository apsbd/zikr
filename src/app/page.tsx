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
import { ScrollArea } from '@/components/ui/scroll-area';
import LandingPage from '@/components/LandingPage';

function Dashboard() {
    const router = useRouter();
    const { data: displayDecks = [], isLoading, error } = useDeckDisplay();

    useEffect(() => {
        if (error) {
            console.error('Error loading decks:', error);
        }
    }, [error]);

    const handleStudy = (deckId: string) => {
        router.push(`/study/${deckId}`);
    };

    return (
        <div className='min-h-screen'>
            <UserProfile />
            <ScrollArea
                className='h-screen w-full'
                style={{ height: 'calc(100vh - 80px )' }}>
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
            </ScrollArea>
        </div>
    );
}

export default function Home() {
    const { user, loading } = useAuth();

    useEffect(() => {
        // Clean up old localStorage data on first load
        cleanupOldLocalStorageData();
    }, []);

    // Show loading state while checking auth
    if (loading) {
        return (
            <div className='min-h-screen flex items-center justify-center'>
                <div className='text-center'>
                    <div className='w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4'></div>
                    <p className='text-muted-foreground'>Loading...</p>
                </div>
            </div>
        );
    }

    // Show landing page if not authenticated
    if (!user) {
        return <LandingPage />;
    }

    // Show dashboard if authenticated
    return (
        <ProtectedRoute>
            <Dashboard />
        </ProtectedRoute>
    );
}
