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
      <div className="card-container min-h-[300px]" onClick={!isFlipped ? handleFlip : undefined}>
        <div className={cn("card-inner min-h-[300px]", isFlipped && "flipped", isFirstRender && "no-transition")}>
          {/* Front of card */}
          <div className="card-front">
            <CardContent className="p-8 flex flex-col items-center justify-center text-center min-h-[300px]">
              <div className="space-y-4">
                <div className="text-5xl font-bold text-white mb-4 arabic-text leading-relaxed">
                  {card.front}
                </div>
                <p className="text-gray-400 text-sm">Tap to reveal answer</p>
              </div>
            </CardContent>
          </div>
          
          {/* Back of card */}
          <div className="card-back">
            <CardContent className="p-8 flex flex-col items-center justify-center text-center min-h-[300px]">
              <div className="space-y-6 w-full">
                <div className="text-4xl font-bold text-white mb-4 arabic-text leading-relaxed">
                  {card.front}
                </div>
                <div className="space-y-3">
                  <div className="text-2xl font-semibold text-gray-200 leading-relaxed">
                    {card.back.bangla}
                  </div>
                  <div className="text-xl text-gray-300 leading-relaxed">
                    {card.back.english}
                  </div>
                </div>
              </div>
            </CardContent>
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