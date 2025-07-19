'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { SyncDialog } from '@/components/SyncDialog';
import { scrollPosition } from '@/lib/scroll-position';

function Dashboard() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user } = useAuth();
    const { isOnline, isFullSyncRunning, refreshStatus } = useSyncStatus();
    const [displayDecks, setDisplayDecks] = useState<DeckWithStats[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);
    const [syncDialogOpen, setSyncDialogOpen] = useState(false);
    const loadDecksTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const scrollAreaRef = useRef<HTMLDivElement>(null);

    const loadDecks = async () => {
        if (!user) return;
        
        try {
            setIsLoading(true);
            setError(null);
            
            // Small delay when refreshing to ensure we get the latest data
            const refreshParam = searchParams.get('refresh');
            if (refreshParam) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
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

    // Debounced version of loadDecks to prevent multiple rapid calls
    const debouncedLoadDecks = () => {
        if (loadDecksTimeoutRef.current) {
            clearTimeout(loadDecksTimeoutRef.current);
        }
        
        loadDecksTimeoutRef.current = setTimeout(() => {
            loadDecks();
        }, 300); // 300ms debounce
    };


    useEffect(() => {
        const initializeOfflineService = async () => {
            if (!user || isInitialized) return;
            
            try {
                // Initialize offline service WITHOUT automatic sync
                await offlineService.init();
                
                // Just set the user without syncing
                await offlineService.setCurrentUser(user.id);
                
                console.log('🔒 Offline-first mode: No automatic sync');
                
                setIsInitialized(true);
                
                // Load decks immediately after login completes
                await loadDecks();
                
                // Check if we should auto-download data
                const autoDownloadKey = `auto-download-attempted-${user.id}`;
                const hasAttemptedDownload = localStorage.getItem(autoDownloadKey);
                
                if (!hasAttemptedDownload && isOnline) {
                    // Check if user has any decks
                    const decks = await offlineService.getDecks();
                    if (!decks || decks.length === 0) {
                        // Mark that we've attempted auto-download
                        localStorage.setItem(autoDownloadKey, 'true');
                        
                        // Trigger download from server
                        console.log('📥 No decks found, triggering auto-download...');
                        try {
                            const result = await offlineService.performManualDownload(user.id);
                            if (result.success) {
                                console.log(`✅ Auto-download successful: ${result.synced_count} items downloaded`);
                                // Reload decks after download
                                await loadDecks();
                            }
                        } catch (error) {
                            console.error('❌ Auto-download failed:', error);
                        }
                    }
                }
                
                // Refresh sync status
                await refreshStatus();
            } catch (err) {
                console.error('Failed to initialize offline service:', err);
                setError('Failed to initialize app - working offline');
                setIsInitialized(true);
            }
        };
        
        initializeOfflineService();
    }, [user?.id, isOnline]); // Depend on user.id and isOnline
    
    // Refresh when the refresh param changes (when returning from study)
    // Remove refresh parameter handling as it causes offline page issues

    // Force refresh when returning to dashboard
    useEffect(() => {
        if (!isInitialized || !user) return;
        
        const handleFocus = () => {
            debouncedLoadDecks();
        };

        window.addEventListener('focus', handleFocus);
        
        // Also refresh on window focus to get latest progress
        const handleVisibilityChange = () => {
            if (!document.hidden) {
                debouncedLoadDecks();
            }
        };
        
        document.addEventListener('visibilitychange', handleVisibilityChange);
        
        // Listen for navigation events (when returning from study page)
        const handlePopState = () => {
            debouncedLoadDecks();
        };
        
        window.addEventListener('popstate', handlePopState);
        
        // Initial load
        loadDecks();
        
        return () => {
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('popstate', handlePopState);
            // Clear timeout on cleanup
            if (loadDecksTimeoutRef.current) {
                clearTimeout(loadDecksTimeoutRef.current);
            }
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

    // Restore scroll position when decks are loaded
    useEffect(() => {
        if (displayDecks.length > 0 && scrollAreaRef.current) {
            setTimeout(() => {
                const viewport = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
                if (viewport) {
                    const savedPosition = scrollPosition.getPosition('dashboard');
                    viewport.scrollTop = savedPosition;
                }
            }, 100);
        }
    }, [displayDecks]);

    const handleStudy = (deckId: string) => {
        // Save scroll position before navigating
        if (scrollAreaRef.current) {
            const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (viewport) {
                scrollPosition.savePosition('dashboard', viewport.scrollTop);
            }
        }
        
        // If offline, redirect to offline-study page with deck ID
        if (!isOnline) {
            localStorage.setItem('offline-study-deck-id', deckId);
            router.push('/offline-study');
        } else {
            router.push(`/study/${deckId}`);
        }
    };

    return (
        <div className='min-h-screen'>
            <UserProfile />
            <ScrollArea
                ref={scrollAreaRef}
                className='h-screen w-full'
                style={{ height: 'calc(100vh - 80px )' }}>
                <div className='w-full sm:max-w-4xl sm:mx-auto py-8 px-2 sm:px-4 lg:px-8 pb-24'>
                    {/* Removed automatic sync status - now manual only */}
                    
                    {/* Sync Button */}
                    <div className='mb-6 flex justify-center'>
                        <Button
                            onClick={() => setSyncDialogOpen(true)}
                            variant='outline'
                            size='sm'
                            className='gap-2'
                        >
                            <RefreshCw className='w-4 h-4' />
                            Sync Progress
                        </Button>
                    </div>
                    
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
            
            {/* Sync Dialog */}
            <SyncDialog
                open={syncDialogOpen}
                onOpenChange={setSyncDialogOpen}
                onSyncComplete={() => {
                    // Reload decks after sync
                    loadDecks();
                }}
            />
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
