'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Card as CardType, Rating } from '@/types';
import { cn } from '@/lib/utils';

interface StudyCardProps {
  card: CardType;
  onRate: (rating: Rating) => void;
  isLast: boolean;
}

export function StudyCard({ card, onRate, isLast }: StudyCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isFirstRender, setIsFirstRender] = useState(true);

  // Reset flip state when card changes
  useEffect(() => {
    setIsFlipped(false);
    setIsFirstRender(false);
  }, [card.id]);

  const handleFlip = () => {
    setIsFlipped(true);
  };

  const handleRate = (rating: Rating) => {
    onRate(rating);
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="flip-container min-h-[300px]" onClick={!isFlipped ? handleFlip : undefined}>
        <div className={cn("flip-card min-h-[300px]", isFlipped && "flipped", isFirstRender && "no-transition")}>
          {/* Front of card */}
          <div className="flip-card-front">
            <div className="space-y-4">
              <div className="study-card-arabic arabic-text text-white">
                {card.front}
              </div>
              <p className="text-gray-400 text-sm">Tap to reveal answer</p>
            </div>
          </div>
          
          {/* Back of card */}
          <div className="flip-card-back">
            <div className="space-y-6 w-full">
              <div className="space-y-3">
                <div className="study-card-translation text-gray-200 font-semibold">
                  {card.back.bangla}
                </div>
                <div className="study-card-translation text-gray-300">
                  {card.back.english}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isFlipped && (
        <div className="mt-6 grid grid-cols-2 gap-3 button-container">
          <button
            onClick={() => handleRate(Rating.Again)}
            className="btn-again"
          >
            Again
          </button>
          <button
            onClick={() => handleRate(Rating.Hard)}
            className="btn-hard"
          >
            Hard
          </button>
          <button
            onClick={() => handleRate(Rating.Good)}
            className="btn-good"
          >
            Good
          </button>
          <button
            onClick={() => handleRate(Rating.Easy)}
            className="btn-easy"
          >
            Easy
          </button>
        </div>
      )}
    </div>
  );
}