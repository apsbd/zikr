'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DeckCard } from '@/components/Dashboard/DeckCard';
import { Deck, DeckDisplayInfo } from '@/types';
import { offlineService } from '@/lib/offline';
import type { DeckWithStats } from '@/lib/offline';
import { cleanupOldLocalStorageData } from '@/lib/migration';
import ProtectedRoute from '@/components/Auth/ProtectedRoute';
import UserProfile from '@/components/Auth/UserProfile';
import { useAuth } from '@/contexts/auth';
import { useSyncStatus } from '@/contexts/sync-status';
import { ScrollArea } from '@/components/ui/scroll-area';
import LandingPage from '@/components/LandingPage';

function Dashboard() {
    const router = useRouter();
    const { user } = useAuth();
    const { isOnline, isFullSyncRunning, refreshStatus } = useSyncStatus();
    const [displayDecks, setDisplayDecks] = useState<DeckWithStats[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);

    const loadDecks = async () => {
        if (!user) return;
        
        try {
            setIsLoading(true);
            setError(null);
            
            // Always try to load from offline storage first (instant)
            const decks = await offlineService.getDecks();
            setDisplayDecks(decks);
        } catch (err) {
            console.error('Failed to load decks:', err);
            setError('Failed to load decks');
        } finally {
            setIsLoading(false);
        }
    };


    useEffect(() => {
        const initializeOfflineService = async () => {
            if (!user || isInitialized) return;
            
            try {
                // Initialize offline service
                await offlineService.init();
                
                // Perform login sync (background auth on page refresh)
                const syncResult = await offlineService.login(user.id, false); // false = background auth
                
                if (!syncResult.success) {
                    console.warn('Login sync had issues:', syncResult);
                    if (syncResult.failed_count > 0) {
                        setError('Some data may not be up to date');
                    }
                }
                
                setIsInitialized(true);
                
                // Load decks immediately after login completes
                await loadDecks();
                
                // Refresh sync status
                await refreshStatus();
            } catch (err) {
                console.error('Failed to initialize offline service:', err);
                setError('Failed to initialize app - working offline');
                setIsInitialized(true);
            }
        };
        
        initializeOfflineService();
    }, [user?.id]); // Only depend on user.id, not the entire user object
    

    // Force refresh when returning to dashboard
    useEffect(() => {
        if (!isInitialized || !user) return;
        
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
    }, [user, isInitialized]);

    // Auto-refresh for due cards
    useEffect(() => {
        if (!user || !isInitialized || displayDecks.length === 0) return;

        // Refresh every 5 minutes to update due card counts
        const intervalId = setInterval(() => {
            loadDecks();
        }, 5 * 60 * 1000);

        return () => clearInterval(intervalId);
    }, [user, isInitialized, displayDecks]);


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
                    {/* Sync Status - Only show during login */}
                    {isFullSyncRunning && (
                        <div className='mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg'>
                            <div className='flex items-center justify-center'>
                                <div className='w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-3'></div>
                                <div className='text-center'>
                                    <p className='text-sm font-medium text-blue-700'>
                                        Syncing your data...
                                    </p>
                                    <p className='text-xs text-blue-600'>
                                        This happens once when you login
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {/* Offline Status */}
                    {!isOnline && (
                        <div className='mb-6 relative overflow-hidden rounded-2xl bg-gradient-to-r from-zinc-900/90 to-zinc-800/90 backdrop-blur-sm border border-zinc-700/50'>
                            <div className='absolute inset-0 bg-gradient-to-r from-orange-500/10 to-amber-500/10'></div>
                            <div className='relative px-6 py-4'>
                                <div className='flex items-center justify-center gap-3'>
                                    <div className='flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/20'>
                                        <div className='w-2 h-2 rounded-full bg-orange-500 animate-pulse'></div>
                                    </div>
                                    <div className='text-center'>
                                        <p className='text-sm font-medium text-zinc-100'>
                                            Offline Mode
                                        </p>
                                        <p className='text-xs text-zinc-400'>
                                            Your progress is saved locally
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Error State */}
                    {error && isOnline && (
                        <div className='mb-6 p-4 bg-red-50 border border-red-200 rounded-lg'>
                            <div className='text-center'>
                                <p className='text-sm font-medium text-red-700'>
                                    {error}
                                </p>
                                <p className='text-xs text-red-600'>
                                    Some features may not work properly
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
                                onReloadData={loadDecks}
                            />
                        ))}
                    </div>

                    {isLoading && (
                        <div className='text-center py-12'>
                            <div className='w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4'></div>
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
                            {!isOnline && (
                                <p className='text-sm text-muted-foreground mt-2'>
                                    Connect to internet to sync your decks
                                </p>
                            )}
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
