'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { StudyCard } from '@/components/StudyCard/StudyCard';
import { BackButton } from '@/components/Navigation/BackButton';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card as CardType, Rating, StudySession as StudySessionType } from '@/types';
import type { OfflineUserProgress } from '@/lib/offline/types';
import { SyncStatus } from '@/lib/offline/indexeddb-schema';
import { offlineService } from '@/lib/offline';
import { reviewCard } from '@/lib/fsrs';
import { CheckCircle, RotateCcw, ArrowLeft } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface StudySessionProps {
  deckId: string;
  deckTitle: string;
  userId: string;
  isOnline: boolean;
  isOfflineMode?: boolean;
  onComplete?: () => void;
}

export function StudySession({ 
  deckId, 
  deckTitle, 
  userId, 
  isOnline, 
  isOfflineMode = false,
  onComplete 
}: StudySessionProps) {
  const router = useRouter();
  const [session, setSession] = React.useState<StudySessionType | null>(null);
  const [cards, setCards] = React.useState<CardType[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = React.useState(0);
  const [isComplete, setIsComplete] = React.useState(false);
  const [reviewedCards, setReviewedCards] = React.useState<string[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const loadStudyData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Initialize offline service
        await offlineService.init();
        await offlineService.setCurrentUser(userId);

        // Get due cards
        const dueCards = await offlineService.getDueCards(deckId);
        
        if (dueCards.length === 0) {
          setError('No cards due for review');
          setIsLoading(false);
          return;
        }

        setCards(dueCards);
        
        // Create a new study session
        const newSession: StudySessionType = {
          deckId: deckId,
          cards: dueCards,
          currentIndex: 0,
          completed: false
        };
        
        setSession(newSession);
        setIsLoading(false);
      } catch (err) {
        console.error('Failed to load study data:', err);
        setError('Failed to load deck data');
        setIsLoading(false);
      }
    };

    loadStudyData();
  }, [deckId, userId]);

  const handleRating = async (rating: Rating) => {
    if (!session || !cards[currentCardIndex]) return;

    const card = cards[currentCardIndex];
    
    try {
      // Calculate next review
      const updatedCard = reviewCard(card, rating);
      
      // Save progress to IndexedDB
      const progressData: OfflineUserProgress = {
        id: crypto.randomUUID(),
        user_id: userId,
        card_id: card.id,
        state: updatedCard.fsrsData.state,
        difficulty: updatedCard.fsrsData.difficulty,
        stability: updatedCard.fsrsData.stability,
        retrievability: 0,
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
      
      await offlineService.updateUserProgress(progressData);

      // Update reviewed cards list
      setReviewedCards(prev => [...prev, card.id]);

      // Move to next card or complete
      if (currentCardIndex < cards.length - 1) {
        setCurrentCardIndex(prev => prev + 1);
      } else {
        // Complete the session
        await completeSession();
      }
    } catch (error) {
      console.error('Failed to save progress:', error);
      // Continue with session even if save fails
      if (currentCardIndex < cards.length - 1) {
        setCurrentCardIndex(prev => prev + 1);
      } else {
        await completeSession();
      }
    }
  };

  const completeSession = async () => {
    if (!session) return;

    // Update session
    const completedSession: StudySessionType = {
      ...session,
      completed: true
    };

    setSession(completedSession);
    setIsComplete(true);

    // Clear stored deck ID if in offline mode
    if (isOfflineMode) {
      localStorage.removeItem('offline-study-deck-id');
    }

    // Call onComplete callback if provided
    if (onComplete) {
      onComplete();
    }
  };

  const handleBack = () => {
    if (isOfflineMode) {
      localStorage.removeItem('offline-study-deck-id');
    }
    router.push('/');
  };

  const handleRestart = () => {
    setCurrentCardIndex(0);
    setIsComplete(false);
    setReviewedCards([]);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <h1 className="text-xl font-semibold mb-2">Loading Study Session...</h1>
          <p className="text-muted-foreground">Preparing your cards for review</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button 
            onClick={handleBack} 
            className="w-full mt-4"
            variant="outline"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-2xl mx-auto">
          <div className="mb-4">
            <BackButton href="/" />
          </div>
          <Card className="max-w-md mx-auto">
            <CardContent className="p-8 text-center">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Session Complete!</h2>
              <p className="text-muted-foreground mb-6">
                You reviewed {reviewedCards.length} card{reviewedCards.length !== 1 ? 's' : ''} in this session.
              </p>
              {!isOnline && (
                <p className="text-sm text-orange-600 mb-6">
                  Your progress has been saved offline and will sync when you're back online.
                </p>
              )}
              <div className="flex gap-3 justify-center">
                <Button onClick={() => router.push('/')} variant="default">
                  Back to Dashboard
                </Button>
                {cards.length > reviewedCards.length && (
                  <Button onClick={handleRestart} variant="outline">
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Study Remaining
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const currentCard = cards[currentCardIndex];
  const progress = ((currentCardIndex + 1) / cards.length) * 100;

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <BackButton />
            <h1 className="text-xl font-semibold">{deckTitle}</h1>
            <div className="text-sm text-muted-foreground">
              {currentCardIndex + 1} / {cards.length}
            </div>
          </div>
          <Progress value={progress} className="mt-2" />
          {!isOnline && (
            <div className="text-xs text-center text-orange-600 mt-1">
              Offline Mode - Progress will sync when online
            </div>
          )}
        </div>
      </div>

      <ScrollArea className="h-[calc(100vh-80px)]">
        <div className="container mx-auto px-4 py-8">
          {currentCard && (
            <StudyCard
              card={currentCard}
              onRate={handleRating}
              isLast={currentCardIndex === cards.length - 1}
              currentIndex={currentCardIndex}
              totalCards={cards.length}
            />
          )}
        </div>
      </ScrollArea>
    </div>
  );
}