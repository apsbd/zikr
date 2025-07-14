'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Deck } from '@/types';
import { getCardsForStudy } from '@/lib/fsrs';
import { BookOpen, Clock, RotateCcw, Zap } from 'lucide-react';

interface DeckCardProps {
  deck: Deck;
  onStudy: (deckId: string) => void;
}

export function DeckCard({ deck, onStudy }: DeckCardProps) {
  const cardsToStudy = getCardsForStudy(deck.cards);
  const progressPercentage = deck.stats.total > 0 
    ? ((deck.stats.total - deck.stats.new) / deck.stats.total) * 100 
    : 0;

  return (
    <Card className="w-full max-w-md bg-gray-800 border-gray-700 hover:bg-gray-700 transition-colors">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <BookOpen className="w-5 h-5" />
          {deck.title}
        </CardTitle>
        <CardDescription className="text-gray-300">{deck.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-gray-300">
            <span>Progress</span>
            <span>{Math.round(progressPercentage)}%</span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2 text-gray-300">
            <Zap className="w-4 h-4 text-blue-400" />
            <span>New: {deck.stats.new}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-300">
            <Clock className="w-4 h-4 text-orange-400" />
            <span>Learning: {deck.stats.learning}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-300">
            <RotateCcw className="w-4 h-4 text-green-400" />
            <span>Review: {deck.stats.review}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-300">
            <BookOpen className="w-4 h-4 text-gray-400" />
            <span>Total: {deck.stats.total}</span>
          </div>
        </div>

        <Button 
          onClick={() => onStudy(deck.id)}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          disabled={cardsToStudy.length === 0}
        >
          {cardsToStudy.length > 0 
            ? `Study Now (${cardsToStudy.length} cards)`
            : 'No cards due'
          }
        </Button>
      </CardContent>
    </Card>
  );
}