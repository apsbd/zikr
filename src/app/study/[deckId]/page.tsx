'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { StudyCard } from '@/components/StudyCard/StudyCard';
import { BackButton } from '@/components/Navigation/BackButton';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Deck, Card as CardType, Rating, StudySession } from '@/types';
import { useDeck, useCardProgressMutation } from '@/hooks/queries';
import { reviewCard, getCardsForStudy, getCardStats } from '@/lib/fsrs';
import { CheckCircle, RotateCcw } from 'lucide-react';
import ProtectedRoute from '@/components/Auth/ProtectedRoute';
import { useAuth } from '@/contexts/auth';

interface StudyPageProps {
  params: Promise<{
    deckId: string;
  }>;
}

export default function StudyPage({ params }: StudyPageProps) {
  const [deckId, setDeckId] = useState<string | undefined>();
  const [session, setSession] = useState<StudySession | null>(null);
  const router = useRouter();
  const { user } = useAuth();
  
  const cardProgressMutation = useCardProgressMutation();
  const { data: deck, isLoading, error } = useDeck(deckId);

  React.useEffect(() => {
    params.then(resolvedParams => {
      setDeckId(resolvedParams.deckId);
    });
  }, [params]);

  React.useEffect(() => {
    if (deck) {
      const cardsToStudy = getCardsForStudy(deck.cards);
      
      if (cardsToStudy.length === 0) {
        setSession(null);
        return;
      }

      setSession({
        deckId: deck.id,
        cards: cardsToStudy,
        currentIndex: 0,
        completed: false,
      });
    }
  }, [deck]);

  React.useEffect(() => {
    if (error) {
      console.error('Error loading deck:', error);
      router.push('/');
    }
  }, [error, router]);

  const handleRating = async (rating: Rating) => {
    if (!session || !deck) return;

    try {
      const currentCard = session.cards[session.currentIndex];
      const updatedCard = reviewCard(currentCard, rating);
      
      // Save progress to database with optimistic update
      cardProgressMutation.mutate({
        cardId: updatedCard.id,
        fsrsData: updatedCard.fsrsData
      });

      const nextIndex = session.currentIndex + 1;
      if (nextIndex >= session.cards.length) {
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

  const handleStudyAgain = () => {
    if (!deck) return;
    
    const cardsToStudy = getCardsForStudy(deck.cards);
    if (cardsToStudy.length > 0) {
      setSession({
        deckId: deck.id,
        cards: cardsToStudy,
        currentIndex: 0,
        completed: false,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-2xl mx-auto">
          <div className="mb-4">
            <BackButton href="/" />
          </div>
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading study session...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!deck) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-2xl mx-auto">
          <div className="mb-4">
            <BackButton href="/" />
          </div>
          <div className="text-center py-12">
            <p className="text-destructive">Deck not found</p>
          </div>
        </div>
      </div>
    );
  }

  if (!session || session.cards.length === 0) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-2xl mx-auto">
          <div className="mb-4">
            <BackButton href="/" />
          </div>
          <Card className="max-w-md mx-auto">
            <CardContent className="p-8 text-center">
              <CheckCircle className="w-16 h-16 text-primary mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">No Cards Due</h2>
              <p className="text-muted-foreground mb-6">
                All cards in this deck have been studied recently. Check back later for more reviews.
              </p>
              <Button onClick={handleReturnToDashboard} className="w-full">
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
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-2xl mx-auto">
          <div className="mb-4">
            <BackButton href="/" />
          </div>
          <Card className="max-w-md mx-auto">
            <CardContent className="p-8 text-center">
              <CheckCircle className="w-16 h-16 text-primary mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Study Session Complete!</h2>
              <p className="text-muted-foreground mb-6">
                Great job! You've completed {session.cards.length} cards in this session.
              </p>
              <div className="space-y-3">
                <Button onClick={handleStudyAgain} className="w-full">
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Study More Cards
                </Button>
                <Button variant="outline" onClick={handleReturnToDashboard} className="w-full">
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
  const progressPercentage = ((session.currentIndex + 1) / session.cards.length) * 100;

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-2xl mx-auto">
          <div className="mb-4">
            <BackButton href="/" />
          </div>
          
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-lg font-semibold">{deck.title}</h2>
              <span className="text-sm text-muted-foreground">
                {session.currentIndex + 1} of {session.cards.length}
              </span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>

          <StudyCard
            card={currentCard}
            onRate={handleRating}
            isLast={session.currentIndex === session.cards.length - 1}
          />
        </div>
      </div>
    </ProtectedRoute>
  );
}