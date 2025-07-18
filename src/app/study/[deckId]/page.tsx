'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { StudyCard } from '@/components/StudyCard/StudyCard';
import { BackButton } from '@/components/Navigation/BackButton';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Deck, Card as CardType, Rating, StudySession } from '@/types';
import type { OfflineUserProgress } from '@/lib/offline/types';
import { SyncStatus } from '@/lib/offline/indexeddb-schema';
import { offlineService } from '@/lib/offline';
import { reviewCard, getCardStats } from '@/lib/fsrs';
import { CheckCircle, RotateCcw } from 'lucide-react';
import ProtectedRoute from '@/components/Auth/ProtectedRoute';
import { useAuth } from '@/contexts/auth';
import { useSyncStatus } from '@/contexts/sync-status';
import { ScrollArea } from '@/components/ui/scroll-area';

interface StudyPageProps {
    params: Promise<{
        deckId: string;
    }>;
}

function StudyPageContent({ params }: StudyPageProps) {
    const [deckId, setDeckId] = useState<string | undefined>();
    const [session, setSession] = useState<StudySession | null>(null);
    const [currentDeck, setCurrentDeck] = useState<any>(null);
    const [studyData, setStudyData] = useState<CardType[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [retryCount, setRetryCount] = useState(0);
    const router = useRouter();
    const { user } = useAuth();
    const { isOnline, isFullSyncRunning } = useSyncStatus();

    const loadStudyData = async (deckId: string, isRetry = false) => {
        if (!user) return;
        
        try {
            setIsLoading(true);
            if (!isRetry) {
                setError(null);
                setRetryCount(0);
            }
            
            // Initialize offline service
            await offlineService.init();
            
            // Perform login sync if online (background auth)
            if (navigator.onLine && isOnline) {
                try {
                    await offlineService.login(user.id, false);
                } catch (syncError) {
                    console.warn('Sync failed, continuing with offline data:', syncError);
                }
            }
            
            // Get deck metadata from offline service
            const deck = await offlineService.getDeck(deckId);
            setCurrentDeck(deck);
            
            if (!deck) {
                // Don't show error immediately if offline, try to wait for initialization
                if (!isOnline && !isRetry) {
                    setTimeout(() => loadStudyData(deckId, true), 1000);
                    return;
                }
                setError(!isOnline ? 'Deck not available offline. Please connect to internet to sync.' : 'Deck not found');
                return;
            }
            
            // Get study cards from offline service (only due cards)
            const cards = await offlineService.getDueCards(deckId);
            setStudyData(cards);
            
        } catch (err) {
            console.error('Failed to load study data:', err);
            // If offline and first attempt, retry once after a delay
            if (!isOnline && !isRetry) {
                setTimeout(() => loadStudyData(deckId, true), 1000);
                return;
            }
            const errorMessage = !isOnline 
                ? 'Failed to load study data offline. Please connect to internet to sync your data.' 
                : 'Failed to load study data. Please try again.';
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };


    React.useEffect(() => {
        params.then((resolvedParams) => {
            setDeckId(resolvedParams.deckId);
            loadStudyData(resolvedParams.deckId);
        });
    }, [params, user]);

    React.useEffect(() => {
        if (studyData && deckId && !session) {
            if (studyData.length === 0) {
                setSession(null);
                return;
            }

            // Load all due cards at once
            setSession({
                deckId: deckId,
                cards: studyData,
                currentIndex: 0,
                completed: false
            });
        }
    }, [studyData, deckId, session]);

    const handleRetry = async () => {
        if (deckId) {
            setRetryCount(prev => prev + 1);
            await loadStudyData(deckId, true);
        }
    };

    React.useEffect(() => {
        // Only redirect to home if it's a critical error and we're not offline
        if (error && isOnline && !deckId) {
            router.push('/');
        }
    }, [error, router, isOnline, deckId]);

    const handleRating = async (rating: Rating) => {
        if (!session || !studyData) return;

        try {
            const currentCard = session.cards[session.currentIndex];
            const updatedCard = reviewCard(currentCard, rating);

            // Save progress to offline service
            if (user) {
                const progressData: OfflineUserProgress = {
                    id: crypto.randomUUID(), // Generate new UUID, will be replaced if record exists
                    user_id: user.id,
                    card_id: updatedCard.id,
                    state: updatedCard.fsrsData.state,
                    difficulty: updatedCard.fsrsData.difficulty,
                    stability: updatedCard.fsrsData.stability,
                    retrievability: 0, // Default value
                    due: updatedCard.fsrsData.due.toISOString(),
                    elapsed_days: updatedCard.fsrsData.elapsed_days,
                    scheduled_days: updatedCard.fsrsData.scheduled_days,
                    reps: updatedCard.fsrsData.reps,
                    lapses: updatedCard.fsrsData.lapses,
                    last_review: updatedCard.fsrsData.last_review?.toISOString(),
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    sync_status: SyncStatus.PENDING,
                    local_changes: true
                };
                
                // Wait for progress to be saved before continuing
                await offlineService.updateUserProgress(progressData);
                
                // Small delay to ensure IndexedDB write is complete
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            const nextIndex = session.currentIndex + 1;
            if (nextIndex >= session.cards.length) {
                // All cards have been studied
                setSession({ ...session, completed: true });
            } else {
                setSession({ ...session, currentIndex: nextIndex });
            }
        } catch (error) {
            console.error('Error saving progress:', error);
            // Continue with session even if save fails (offline support)
            // The progress will be saved locally and synced when online
            
            const nextIndex = session.currentIndex + 1;
            if (nextIndex >= session.cards.length) {
                setSession({ ...session, completed: true });
            } else {
                setSession({ ...session, currentIndex: nextIndex });
            }
        }
    };

    const handleReturnToDashboard = async () => {
        // Small delay to ensure any pending saves are complete
        await new Promise(resolve => setTimeout(resolve, 200));
        // Force a refresh by adding a timestamp query param
        router.push('/?refresh=' + Date.now());
    };

    const handleStudyAgain = async () => {
        if (!deckId || !user) return;

        // Reload study data to get fresh cards
        try {
            const cards = await offlineService.getDueCards(deckId);
            setStudyData(cards);
            
            if (cards.length > 0) {
                setSession({
                    deckId: deckId,
                    cards: cards,
                    currentIndex: 0,
                    completed: false
                });
            }
        } catch (error) {
            // Error reloading study data
        }
    };

    if (isLoading) {
        return (
            <div className='min-h-screen bg-background p-4'>
                <div className='max-w-2xl mx-auto'>
                    <div className='mb-4'>
                        <BackButton href='/' />
                    </div>
                    <div className='text-center py-12'>
                        {isFullSyncRunning && (
                            <div className='w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4'></div>
                        )}
                        <p className='text-muted-foreground'>
                            {isFullSyncRunning ? 'Syncing data...' : 'Loading study session...'}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className='min-h-screen bg-background p-4'>
                <div className='max-w-2xl mx-auto'>
                    <div className='mb-4'>
                        <BackButton href='/' />
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
                    
                    <Card className='max-w-md mx-auto'>
                        <CardContent className='p-8 text-center'>
                            <div className='w-16 h-16 text-destructive mx-auto mb-4'>
                                <svg fill='currentColor' viewBox='0 0 20 20'>
                                    <path fillRule='evenodd' d='M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z' clipRule='evenodd' />
                                </svg>
                            </div>
                            <h2 className='text-2xl font-bold mb-2 text-destructive'>
                                Error Loading Study Data
                            </h2>
                            <p className='text-muted-foreground mb-6'>
                                {error}
                            </p>
                            <div className='space-y-3'>
                                <Button
                                    onClick={handleRetry}
                                    className='w-full'
                                    disabled={retryCount >= 3}>
                                    <RotateCcw className='w-4 h-4 mr-2' />
                                    {retryCount >= 3 ? 'Max retries reached' : `Retry ${retryCount > 0 ? `(${retryCount}/3)` : ''}`}
                                </Button>
                                <Button
                                    onClick={handleReturnToDashboard}
                                    variant='outline'
                                    className='w-full'>
                                    Return to Dashboard
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    if (!currentDeck || !studyData) {
        return (
            <div className='min-h-screen bg-background p-4'>
                <div className='max-w-2xl mx-auto'>
                    <div className='mb-4'>
                        <BackButton href='/' />
                    </div>
                    <div className='text-center py-12'>
                        <p className='text-destructive'>Deck not found</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!session || session.cards.length === 0) {
        return (
            <div className='min-h-screen bg-background p-4'>
                <div className='max-w-2xl mx-auto'>
                    <div className='mb-4'>
                        <BackButton href='/' />
                    </div>
                    <Card className='max-w-md mx-auto'>
                        <CardContent className='p-8 text-center'>
                            <CheckCircle className='w-16 h-16 text-primary mx-auto mb-4' />
                            <h2 className='text-2xl font-bold mb-2'>
                                No Cards Due
                            </h2>
                            <p className='text-muted-foreground mb-6'>
                                All cards in this deck have been studied
                                recently. Check back later for more reviews.
                            </p>
                            <Button
                                onClick={handleReturnToDashboard}
                                className='w-full'>
                                Return to Dashboard
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    if (session.completed) {
        return (
            <div className='min-h-screen bg-background p-4'>
                <div className='max-w-2xl mx-auto'>
                    <div className='mb-4'>
                        <BackButton href='/' />
                    </div>
                    <Card className='max-w-md mx-auto'>
                        <CardContent className='p-8 text-center'>
                            <CheckCircle className='w-16 h-16 text-primary mx-auto mb-4' />
                            <h2 className='text-2xl font-bold mb-2'>
                                Study Session Complete!
                            </h2>
                            <p className='text-muted-foreground mb-6'>
                                Great job! You've completed{' '}
                                {session.cards.length} cards in this session.
                            </p>
                            <div className='space-y-3'>
                                <Button
                                    onClick={handleStudyAgain}
                                    className='w-full'>
                                    <RotateCcw className='w-4 h-4 mr-2' />
                                    Study More Cards
                                </Button>
                                <Button
                                    variant='outline'
                                    onClick={handleReturnToDashboard}
                                    className='w-full'>
                                    Return to Dashboard
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    const currentCard = session.cards[session.currentIndex];
    // Calculate progress based on total session cards
    const totalCards = session.cards.length;
    const currentProgress = session.currentIndex + 1;
    const progressPercentage = totalCards > 0 
        ? (currentProgress / totalCards) * 100 
        : 0;

    return (
        <ScrollArea
            className='h-screen w-full'
            style={{ height: 'calc(100vh)' }}>
            <div className='min-h-screen bg-background p-4'>
                <div className='w-full mb-6'>
                    {/* Desktop layout - side by side */}
                    <div className='hidden md:block'>
                        <div className='relative flex items-center justify-center mb-2'>
                            <div className='absolute left-0'>
                                <BackButton href='/' />
                            </div>
                            <h2 className='text-lg font-semibold text-center'>
                                {currentDeck?.title}
                            </h2>
                        </div>
                    </div>
                    
                    {/* Mobile layout - stacked */}
                    <div className='md:hidden'>
                        <div className='mb-2'>
                            <BackButton href='/' />
                        </div>
                        <h2 className='text-base font-semibold text-center px-2'>
                            {currentDeck?.title}
                        </h2>
                    </div>
                    
                    {/* Offline Status */}
                    {!isOnline && (
                        <div className='max-w-2xl mx-auto mb-4 relative overflow-hidden rounded-xl bg-gradient-to-r from-zinc-900/90 to-zinc-800/90 backdrop-blur-sm border border-zinc-700/50'>
                            <div className='absolute inset-0 bg-gradient-to-r from-orange-500/10 to-amber-500/10'></div>
                            <div className='relative px-4 py-3'>
                                <div className='flex items-center justify-center gap-2'>
                                    <div className='flex items-center justify-center w-6 h-6 rounded-full bg-orange-500/20'>
                                        <div className='w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse'></div>
                                    </div>
                                    <div className='text-center'>
                                        <p className='text-xs font-medium text-zinc-100'>
                                            Offline Mode
                                        </p>
                                        <p className='text-xs text-zinc-400'>
                                            Progress saved locally
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {/* Sync Status */}
                    {isFullSyncRunning && (
                        <div className='max-w-2xl mx-auto mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg'>
                            <div className='flex items-center justify-center'>
                                <div className='w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-3'></div>
                                <div className='text-center'>
                                    <p className='text-sm font-medium text-blue-700'>
                                        Syncing data...
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    <div className='max-w-2xl mx-auto mt-2'>
                        <Progress
                            value={progressPercentage}
                            className='h-2'
                        />
                    </div>
                </div>
                <div className='max-w-2xl mx-auto'>

                    <StudyCard
                        card={currentCard}
                        onRate={handleRating}
                        isLast={currentProgress === totalCards}
                        currentIndex={session.currentIndex}
                        totalCards={totalCards}
                    />
                </div>
            </div>
        </ScrollArea>
    );
}

export default function StudyPage({ params }: StudyPageProps) {
    return (
        <ProtectedRoute>
            <StudyPageContent params={params} />
        </ProtectedRoute>
    );
}
