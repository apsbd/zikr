'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { StudySession } from '@/components/StudySession/StudySession';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BackButton } from '@/components/Navigation/BackButton';
import { CheckCircle, RotateCcw } from 'lucide-react';
import ProtectedRoute from '@/components/Auth/ProtectedRoute';
import { useAuth } from '@/contexts/auth';
import { useSyncStatus } from '@/contexts/sync-status';
import { offlineService } from '@/lib/offline';
import type { DeckWithStats } from '@/lib/offline';

interface StudyPageProps {
    params: Promise<{
        deckId: string;
    }>;
}

function StudyPageContent({ params }: StudyPageProps) {
    const [deckId, setDeckId] = useState<string | null>(null);
    const [deckTitle, setDeckTitle] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [retryCount, setRetryCount] = useState(0);
    const [hasNoDueCards, setHasNoDueCards] = useState(false);
    const router = useRouter();
    const { user } = useAuth();
    const { isOnline, isFullSyncRunning } = useSyncStatus();

    const loadDeckData = async (deckId: string, isRetry = false) => {
        if (!user) return;
        
        try {
            setIsLoading(true);
            if (!isRetry) {
                setError(null);
                setRetryCount(0);
            }
            
            // Initialize offline service WITHOUT automatic sync
            await offlineService.init();
            
            // Just ensure user is set
            await offlineService.setCurrentUser(user.id);
            
            console.log('🔒 Offline-first mode: Loading from local data only');
            
            // Always try to get deck metadata from offline service (IndexedDB)
            const deck = await offlineService.getDeck(deckId);
            
            if (!deck) {
                setError('Deck not found');
                setIsLoading(false);
                return;
            }
            
            setDeckTitle(deck.title);
            
            // Check if there are due cards
            const cards = await offlineService.getDueCards(deckId);
            if (cards.length === 0) {
                setHasNoDueCards(true);
            }
            
            setIsLoading(false);
        } catch (err) {
            console.error('Failed to load deck data:', err);
            // If offline and first attempt, retry once after a delay
            if (!isOnline && !isRetry) {
                setTimeout(() => loadDeckData(deckId, true), 1000);
                return;
            }
            const errorMessage = !isOnline 
                ? 'Failed to load deck data offline. Please connect to internet to sync your data.' 
                : 'Failed to load deck data. Please try again.';
            setError(errorMessage);
            setIsLoading(false);
        }
    };


    React.useEffect(() => {
        params.then((resolvedParams) => {
            setDeckId(resolvedParams.deckId);
            loadDeckData(resolvedParams.deckId);
        });
    }, [params, user]);

    const handleRetry = async () => {
        if (deckId) {
            setRetryCount(prev => prev + 1);
            await loadDeckData(deckId, true);
        }
    };

    const handleReturnToDashboard = async () => {
        // Increased delay to ensure IndexedDB writes are fully complete
        await new Promise(resolve => setTimeout(resolve, 500));
        // Navigate to dashboard without query params
        router.push('/');
    };

    if (isLoading) {
        return (
            <div className='min-h-screen bg-background flex items-center justify-center p-4'>
                <div className='text-center'>
                    <div className='w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4'></div>
                    <h1 className='text-xl font-semibold mb-2'>Loading Study Session...</h1>
                    <p className='text-muted-foreground'>
                        Preparing your cards for review
                    </p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className='min-h-screen bg-background flex items-center justify-center p-4'>
                <div className='max-w-md w-full'>
                    <Alert variant='destructive'>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                    <div className='space-y-3 mt-4'>
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
                </div>
            </div>
        );
    }

    if (hasNoDueCards) {
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

    if (!deckId || !user) {
        return null;
    }

    return (
        <StudySession
            deckId={deckId}
            deckTitle={deckTitle}
            userId={user.id}
            isOnline={isOnline}
            isOfflineMode={false}
        />
    );
}

export default function StudyPage({ params }: StudyPageProps) {
    return (
        <ProtectedRoute>
            <StudyPageContent params={params} />
        </ProtectedRoute>
    );
}
