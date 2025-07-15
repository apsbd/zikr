'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DeckCard } from '@/components/Dashboard/DeckCard';
import { Deck, DeckDisplayInfo } from '@/types';
import { syncManager } from '@/lib/sync-manager';
import { localStorageService } from '@/lib/local-storage';
import { cleanupOldLocalStorageData } from '@/lib/migration';
import ProtectedRoute from '@/components/Auth/ProtectedRoute';
import UserProfile from '@/components/Auth/UserProfile';
import { useAuth } from '@/contexts/auth';
import { ScrollArea } from '@/components/ui/scroll-area';
import LandingPage from '@/components/LandingPage';

function Dashboard() {
    const router = useRouter();
    const { user } = useAuth();
    const [displayDecks, setDisplayDecks] = useState<DeckDisplayInfo[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadDecks = async () => {
        if (!user) return;
        
        try {
            setIsLoading(true);
            setError(null);
            
            // Check if data is initialized
            if (!localStorageService.isInitialized(user.id)) {
                setIsSyncing(true);
                // Initialize sync manager (first time sync)
                await syncManager.initialize(user.id);
                setIsSyncing(false);
            }
            
            // Load decks from localStorage (instant)
            const decks = localStorageService.getDecks(user.id);
            console.log('Loaded decks from localStorage:', decks.length);
            setDisplayDecks(decks);
        } catch (err) {
            console.error('Error loading decks:', err);
            setError('Failed to load decks');
        } finally {
            setIsLoading(false);
            setIsSyncing(false);
        }
    };

    // Force full resync (for debugging)
    const forceResync = async () => {
        if (!user) return;
        setIsSyncing(true);
        try {
            await syncManager.forceFullSync(user.id);
            const decks = localStorageService.getDecks(user.id);
            setDisplayDecks(decks);
        } catch (err) {
            console.error('Error during force resync:', err);
        } finally {
            setIsSyncing(false);
        }
    };

    useEffect(() => {
        loadDecks();
        
        // Initialize sync manager when component mounts
        if (user) {
            syncManager.initialize(user.id);
        }
        
        // Listen for data updates and sync events
        const handleDataUpdate = () => {
            console.log('Data updated - refreshing dashboard...');
            if (user) {
                const decks = localStorageService.getDecks(user.id);
                console.log('Refreshed dashboard with', decks.length, 'decks');
                setDisplayDecks(decks);
            }
        };
        
        const handleSyncStarted = () => {
            console.log('Sync started');
            setIsSyncing(true);
        };
        
        const handleSyncCompleted = () => {
            console.log('Sync completed - refreshing dashboard...');
            setIsSyncing(false);
            if (user) {
                const decks = localStorageService.getDecks(user.id);
                setDisplayDecks(decks);
            }
        };
        
        const handleSyncError = (event: any) => {
            console.error('Sync error:', event.detail?.error);
            setIsSyncing(false);
            setError('Sync failed - working offline');
        };
        
        window.addEventListener('progress-updated', handleDataUpdate);
        window.addEventListener('data-updated', handleDataUpdate);
        window.addEventListener('sync-started', handleSyncStarted);
        window.addEventListener('sync-completed', handleSyncCompleted);
        window.addEventListener('sync-error', handleSyncError);
        
        // Cleanup function
        return () => {
            if (user) {
                syncManager.stopSync();
            }
            window.removeEventListener('progress-updated', handleDataUpdate);
            window.removeEventListener('data-updated', handleDataUpdate);
            window.removeEventListener('sync-started', handleSyncStarted);
            window.removeEventListener('sync-completed', handleSyncCompleted);
            window.removeEventListener('sync-error', handleSyncError);
        };
    }, [user]);

    // Force refresh when returning to dashboard
    useEffect(() => {
        const handleFocus = () => {
            loadDecks();
        };

        window.addEventListener('focus', handleFocus);
        
        // Also refresh on window focus to get latest progress
        const handleVisibilityChange = () => {
            if (!document.hidden) {
                loadDecks();
            }
        };
        
        document.addEventListener('visibilitychange', handleVisibilityChange);
        
        return () => {
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [user]);

    // Auto-refresh based on next review time
    useEffect(() => {
        if (!user || displayDecks.length === 0) return;

        // Find the earliest next review time across all decks
        let earliestReviewTime: Date | null = null;
        displayDecks.forEach(deck => {
            if (deck.nextReviewTime && (!earliestReviewTime || deck.nextReviewTime < earliestReviewTime)) {
                earliestReviewTime = deck.nextReviewTime;
            }
        });

        if (!earliestReviewTime) return;

        const now = new Date();
        const timeUntilReview = earliestReviewTime.getTime() - now.getTime();

        // Don't set timer for past reviews
        if (timeUntilReview <= 0) {
            loadDecks();
            return;
        }

        // Set refresh interval based on time until next review
        let refreshInterval: number;
        if (timeUntilReview <= 60 * 1000) { // Less than 1 minute
            refreshInterval = 1000; // Refresh every second
        } else if (timeUntilReview <= 10 * 60 * 1000) { // Less than 10 minutes
            refreshInterval = 10 * 1000; // Refresh every 10 seconds
        } else if (timeUntilReview <= 60 * 60 * 1000) { // Less than 1 hour
            refreshInterval = 60 * 1000; // Refresh every minute
        } else {
            refreshInterval = 5 * 60 * 1000; // Refresh every 5 minutes
        }

        const intervalId = setInterval(() => {
            loadDecks();
        }, refreshInterval);

        return () => clearInterval(intervalId);
    }, [user, displayDecks]);


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
                    {/* Sync Status */}
                    {isSyncing && (
                        <div className='mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg'>
                            <div className='flex items-center justify-center'>
                                <div className='w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-3'></div>
                                <div className='text-center'>
                                    <p className='text-sm font-medium text-blue-700'>
                                        Syncing data with server...
                                    </p>
                                    <p className='text-xs text-blue-600'>
                                        This may take a moment on first sync
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Error State */}
                    {error && (
                        <div className='mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg'>
                            <div className='text-center'>
                                <p className='text-sm font-medium text-yellow-700'>
                                    {error}
                                </p>
                                <p className='text-xs text-yellow-600'>
                                    App is working offline
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Debug Controls */}
                    {process.env.NODE_ENV === 'development' && (
                        <div className='mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg'>
                            <div className='text-center'>
                                <button
                                    onClick={forceResync}
                                    disabled={isSyncing}
                                    className='px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50'
                                >
                                    {isSyncing ? 'Syncing...' : 'Force Full Resync'}
                                </button>
                                <p className='text-xs text-gray-600 mt-2'>
                                    Development only: Clear local data and re-download everything
                                </p>
                            </div>
                        </div>
                    )}

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
                            <div className='w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4'></div>
                            <p className='text-muted-foreground'>
                                {isSyncing ? 'Syncing data for first time...' : 'Loading decks...'}
                            </p>
                        </div>
                    )}

                    {!isLoading && !isSyncing && displayDecks.length === 0 && (
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
