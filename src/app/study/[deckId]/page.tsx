'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { StudyCard } from '@/components/StudyCard/StudyCard';
import { BackButton } from '@/components/Navigation/BackButton';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Deck, Card as CardType, Rating, StudySession } from '@/types';
import { getDeckById, saveCardProgress } from '@/lib/database';
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
  const [deck, setDeck] = useState<Deck | null>(null);
  const [session, setSession] = useState<StudySession | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    const loadDeck = async () => {
      try {
        const resolvedParams = await params;
        const foundDeck = await getDeckById(resolvedParams.deckId, user?.id);
        if (!foundDeck) {
          router.push('/');
          return;
        }

        setDeck(foundDeck);
        const cardsToStudy = getCardsForStudy(foundDeck.cards);
        
        if (cardsToStudy.length === 0) {
          setLoading(false);
          return;
        }

        setSession({
          deckId: foundDeck.id,
          cards: cardsToStudy,
          currentIndex: 0,
          completed: false,
        });
        setLoading(false);
      } catch (error) {
        console.error('Error loading deck:', error);
        router.push('/');
      }
    };

    loadDeck();
  }, [params, router]);

  const handleRating = async (rating: Rating) => {
    if (!session || !deck) return;

    try {
      const currentCard = session.cards[session.currentIndex];
      const updatedCard = reviewCard(currentCard, rating);
      
      // Save progress to database
      await saveCardProgress(updatedCard.id, updatedCard.fsrsData, user?.id);
      
      // Update deck state with new card progress
      const updatedCards = deck.cards.map(card => 
        card.id === updatedCard.id ? updatedCard : card
      );

      const updatedDeck = {
        ...deck,
        cards: updatedCards,
        stats: getCardStats(updatedCards),
      };

      setDeck(updatedDeck);

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

  const handleStudyAgain = async () => {
    if (!deck) return;
    
    try {
      // Reload deck to get fresh data with updated progress
      const freshDeck = await getDeckById(deck.id, user?.id);
      if (!freshDeck) return;
      
      setDeck(freshDeck);
      const cardsToStudy = getCardsForStudy(freshDeck.cards);
      if (cardsToStudy.length > 0) {
        setSession({
          deckId: freshDeck.id,
          cards: cardsToStudy,
          currentIndex: 0,
          completed: false,
        });
      }
    } catch (error) {
      console.error('Error reloading deck:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 p-4">
        <div className="max-w-2xl mx-auto">
          <div className="mb-4">
            <BackButton href="/" />
          </div>
          <div className="text-center py-12">
            <p className="text-gray-400">Loading study session...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!deck) {
    return (
      <div className="min-h-screen bg-gray-900 p-4">
        <div className="max-w-2xl mx-auto">
          <div className="mb-4">
            <BackButton href="/" />
          </div>
          <div className="text-center py-12">
            <p className="text-red-400">Deck not found</p>
          </div>
        </div>
      </div>
    );
  }

  if (!session || session.cards.length === 0) {
    return (
      <div className="min-h-screen bg-gray-900 p-4">
        <div className="max-w-2xl mx-auto">
          <div className="mb-4">
            <BackButton href="/" />
          </div>
          <Card className="max-w-md mx-auto bg-gray-800 border-gray-700">
            <CardContent className="p-8 text-center">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2 text-white">No Cards Due</h2>
              <p className="text-gray-300 mb-6">
                All cards in this deck have been studied recently. Check back later for more reviews.
              </p>
              <Button onClick={handleReturnToDashboard} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
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
      <div className="min-h-screen bg-gray-900 p-4">
        <div className="max-w-2xl mx-auto">
          <div className="mb-4">
            <BackButton href="/" />
          </div>
          <Card className="max-w-md mx-auto bg-gray-800 border-gray-700">
            <CardContent className="p-8 text-center">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2 text-white">Study Session Complete!</h2>
              <p className="text-gray-300 mb-6">
                Great job! You've completed {session.cards.length} cards in this session.
              </p>
              <div className="space-y-3">
                <Button onClick={handleStudyAgain} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Study More Cards
                </Button>
                <Button variant="outline" onClick={handleReturnToDashboard} className="w-full border-gray-600 text-gray-300 hover:bg-gray-700">
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
      <div className="min-h-screen bg-gray-900 p-4">
        <div className="max-w-2xl mx-auto">
          <div className="mb-4">
            <BackButton href="/" />
          </div>
          
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-lg font-semibold text-white">{deck.title}</h2>
              <span className="text-sm text-gray-400">
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