'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { DeckDisplayInfo } from '@/types';
import { getCardsForStudy } from '@/lib/fsrs';
import { formatNextReviewTime, getTimeIndicatorClass } from '@/lib/data';
import { BookOpen, Clock, RotateCcw, Zap } from 'lucide-react';

interface DeckCardProps {
  deck: DeckDisplayInfo;
  onStudy: (deckId: string) => void;
}

export function DeckCard({ deck, onStudy }: DeckCardProps) {
  const progressPercentage = deck.stats.total > 0 
    ? ((deck.stats.total - deck.stats.new) / deck.stats.total) * 100 
    : 0;
  
  const cardsForStudy = getCardsForStudy(deck.cards);
  const studyCount = cardsForStudy.length;

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
        
        {/* Show due cards count if different from total state counts */}
        {studyCount !== (deck.stats.new + deck.stats.learning + deck.stats.review) && (
          <div className="pt-2 border-t border-gray-700">
            <div className="flex items-center gap-2 text-sm text-yellow-400">
              <Clock className="w-4 h-4" />
              <span>Due now: {studyCount}</span>
            </div>
          </div>
        )}

        {/* Next Review Time */}
        <div className="space-y-2">
          {deck.nextReviewTime ? (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Next review:</span>
              <span className={`text-sm font-medium ${getTimeIndicatorClass(deck.nextReviewTime)}`}>
                {formatNextReviewTime(deck.nextReviewTime)}
              </span>
            </div>
          ) : (
            <div className="text-sm text-gray-400">No pending reviews</div>
          )}
        </div>

        <Button 
          onClick={() => onStudy(deck.id)}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          disabled={studyCount === 0}
        >
          {studyCount > 0
            ? `Study Now (${studyCount} cards)`
            : deck.nextReviewTime && deck.nextReviewTime > new Date()
            ? `Next review: ${formatNextReviewTime(deck.nextReviewTime)}`
            : 'No cards due'
          }
        </Button>
      </CardContent>
    </Card>
  );
}