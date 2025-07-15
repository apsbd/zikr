'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { StudyCard } from '@/components/StudyCard/StudyCard';
import { BackButton } from '@/components/Navigation/BackButton';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Deck, Card as CardType, Rating, StudySession } from '@/types';
import { localStorageService } from '@/lib/local-storage';
import { syncManager } from '@/lib/sync-manager';
import { reviewCard, getCardStats } from '@/lib/fsrs';
import { CheckCircle, RotateCcw } from 'lucide-react';
import ProtectedRoute from '@/components/Auth/ProtectedRoute';
import { useAuth } from '@/contexts/auth';
import { ScrollArea } from '@/components/ui/scroll-area';

interface StudyPageProps {
    params: Promise<{
        deckId: string;
    }>;
}

export default function StudyPage({ params }: StudyPageProps) {
    const [deckId, setDeckId] = useState<string | undefined>();
    const [session, setSession] = useState<StudySession | null>(null);
    const [currentBatch, setCurrentBatch] = useState(0);
    const [currentDeck, setCurrentDeck] = useState<any>(null);
    const [studyData, setStudyData] = useState<CardType[]>([]);
    const [totalCardsStudied, setTotalCardsStudied] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();
    const { user } = useAuth();

    const loadStudyData = async (deckId: string) => {
        if (!user) return;
        
        try {
            setIsLoading(true);
            setError(null);
            
            // Ensure data is initialized (wait for sync if needed)
            if (!localStorageService.isInitialized(user.id)) {
                console.log('Data not initialized, starting sync...');
                setIsSyncing(true);
                await syncManager.initialize(user.id);
                setIsSyncing(false);
            }
            
            // Get deck metadata from localStorage
            const deckMetadata = localStorageService.getDecks(user.id);
            const deck = deckMetadata.find(d => d.id === deckId);
            setCurrentDeck(deck);
            
            if (!deck) {
                setError('Deck not found');
                return;
            }
            
            // Get study cards from localStorage (only due cards)
            const cards = localStorageService.getStudyCards(deckId, user.id);
            console.log(`Loaded ${cards.length} study cards for deck: ${deck.title}`);
            setStudyData(cards);
            
        } catch (err) {
            console.error('Error loading study data:', err);
            setError('Failed to load study data');
        } finally {
            setIsLoading(false);
            setIsSyncing(false);
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

            // Load cards in batches of 10
            const batchSize = 10;
            const cardsToLoad = studyData.slice(0, batchSize);

            // Reset total cards studied for new session
            setTotalCardsStudied(0);
            
            setSession({
                deckId: deckId,
                cards: cardsToLoad,
                currentIndex: 0,
                completed: false
            });
        }
    }, [studyData, deckId, session]);

    // Load more cards when approaching the end of current batch
    React.useEffect(() => {
        if (session && studyData && session.currentIndex >= session.cards.length - 3) {
            const batchSize = 10;
            const totalLoadedCards = totalCardsStudied + session.cards.length;
            const nextBatchStart = totalLoadedCards;
            const nextBatchEnd = nextBatchStart + batchSize;
            const nextBatch = studyData.slice(nextBatchStart, nextBatchEnd);
            
            if (nextBatch.length > 0) {
                setSession(prev => prev ? {
                    ...prev,
                    cards: [...prev.cards, ...nextBatch]
                } : null);
            }
        }
    }, [session, studyData, totalCardsStudied]);

    React.useEffect(() => {
        if (error) {
            console.error('Error loading deck:', error);
            router.push('/');
        }
    }, [error, router]);

    const handleRating = async (rating: Rating) => {
        if (!session || !studyData) return;

        try {
            const currentCard = session.cards[session.currentIndex];
            console.log('Rating card:', currentCard.id, 'with rating:', rating);
            
            const updatedCard = reviewCard(currentCard, rating);
            console.log('Updated card FSRS data:', updatedCard.fsrsData);

            // Save progress to localStorage (will sync to database automatically)
            if (user) {
                console.log('Saving progress for card:', updatedCard.id);
                syncManager.saveCardProgress(updatedCard.id, user.id, updatedCard.fsrsData);
                console.log('Progress save completed');
            } else {
                console.log('No user - not saving progress');
            }

            const nextIndex = session.currentIndex + 1;
            if (nextIndex >= session.cards.length) {
                // Add the completed batch to total cards studied
                setTotalCardsStudied(prev => prev + session.cards.length);
                setSession({ ...session, completed: true });
            } else {
                setSession({ ...session, currentIndex: nextIndex });
            }
        } catch (error) {
            console.error('Error handling rating:', error);
        }
    };

    const handleReturnToDashboard = () => {
        router.push('/');
    };

    const handleStudyAgain = async () => {
        if (!deckId || !user) return;

        // Reload study data to get fresh cards
        try {
            const cards = localStorageService.getStudyCards(deckId, user.id);
            setStudyData(cards);
            
            if (cards.length > 0) {
                // Reset total cards studied for new session
                setTotalCardsStudied(0);
                
                setSession({
                    deckId: deckId,
                    cards: cards.slice(0, 10), // Load first batch
                    currentIndex: 0,
                    completed: false
                });
            }
        } catch (error) {
            console.error('Error reloading study data:', error);
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
                        {isSyncing && (
                            <div className='w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4'></div>
                        )}
                        <p className='text-muted-foreground'>
                            {isSyncing ? 'Syncing data...' : 'Loading study session...'}
                        </p>
                    </div>
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
    // Calculate progress based on total due cards, not loaded cards
    const totalDueCards = studyData.length;
    const overallProgress = totalCardsStudied + session.currentIndex + 1;
    const progressPercentage = totalDueCards > 0 
        ? (overallProgress / totalDueCards) * 100 
        : 0;

    return (
        <ProtectedRoute>
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
                            isLast={
                                overallProgress === totalDueCards
                            }
                            currentIndex={overallProgress - 1}
                            totalCards={totalDueCards}
                        />
                    </div>
                </div>
            </ScrollArea>
        </ProtectedRoute>
    );
}
