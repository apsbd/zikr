'use client';

import { useState, useEffect } from 'react';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { DeckDisplayInfo } from '@/types';
import type { DeckWithStats } from '@/lib/offline';
import { getCardsForStudy } from '@/lib/fsrs';
import { formatNextReviewTime, getTimeIndicatorClass } from '@/lib/data';
import { BookOpen, Clock, RotateCcw, Zap } from 'lucide-react';

interface DeckCardProps {
    deck: DeckWithStats;
    onStudy: (deckId: string) => void;
    onReloadData?: () => void;
}

export function DeckCard({ deck, onStudy, onReloadData }: DeckCardProps) {
    const totalCards = deck.card_count || 0;
    const newCards = deck.new_count || 0;
    const learningCards = deck.learning_count || 0;
    const reviewCards = deck.review_count || 0;
    const dueCount = deck.due_count || 0;
    
    const [countdown, setCountdown] = useState<number | null>(null);
    const [isCountdownActive, setIsCountdownActive] = useState(false);
    
    const progressPercentage = totalCards > 0
        ? ((totalCards - newCards) / totalCards) * 100
        : 0;

    // Use the due_count from the backend calculation for study button
    const studyCount = dueCount;

    // Calculate countdown when next review is less than 1 minute away
    useEffect(() => {
        if (!deck.next_review_time) {
            setCountdown(null);
            setIsCountdownActive(false);
            return;
        }

        const updateCountdown = () => {
            const now = new Date();
            const nextReview = new Date(deck.next_review_time!);
            const diffInSeconds = Math.floor((nextReview.getTime() - now.getTime()) / 1000);
            
            if (diffInSeconds <= 0) {
                setCountdown(0);
                setIsCountdownActive(false);
                // Reload data when countdown reaches 0
                if (onReloadData) {
                    onReloadData();
                }
                return;
            }
            
            // Show countdown only if less than 60 seconds (1 minute)
            if (diffInSeconds < 60) {
                setCountdown(diffInSeconds);
                setIsCountdownActive(true);
            } else {
                setCountdown(null);
                setIsCountdownActive(false);
            }
        };

        // Initial calculation
        updateCountdown();

        // Set up interval only if countdown is active or might become active
        const interval = setInterval(updateCountdown, 1000);
        
        return () => clearInterval(interval);
    }, [deck.next_review_time, onReloadData]);

    // Format countdown display
    const formatCountdown = (seconds: number) => {
        if (seconds <= 0) return 'Ready now';
        return `${seconds}s`;
    };

    return (
        <Card className='w-full hover:bg-muted/50 transition-colors'>
            <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                    <BookOpen className='w-5 h-5' />
                    {deck.title}
                </CardTitle>
                <CardDescription>by {deck.author}</CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
                <div className='space-y-2'>
                    <div className='flex justify-between text-sm text-muted-foreground'>
                        <span>Progress</span>
                        <span>{Math.round(progressPercentage)}%</span>
                    </div>
                    <Progress value={progressPercentage} className='h-2' />
                </div>

                <div className='grid grid-cols-2 gap-4 text-sm'>
                    <div className='flex items-center gap-2 text-muted-foreground'>
                        <Zap className='w-4 h-4 text-primary' />
                        <span>New: {newCards}</span>
                    </div>
                    <div className='flex items-center gap-2 text-muted-foreground'>
                        <Clock className='w-4 h-4 text-orange-500' />
                        <span>Learning: {learningCards}</span>
                    </div>
                    <div className='flex items-center gap-2 text-muted-foreground'>
                        <RotateCcw className='w-4 h-4 text-green-500' />
                        <span>Review: {reviewCards}</span>
                    </div>
                    <div className='flex items-center gap-2 text-muted-foreground'>
                        <BookOpen className='w-4 h-4 text-muted-foreground' />
                        <span>Total: {totalCards}</span>
                    </div>
                </div>

                {/* Due now indicator */}
                {dueCount > 0 && (
                    <div className='pt-2 border-t border-border'>
                        <div className='flex items-center gap-2 text-sm text-yellow-600'>
                            <Clock className='w-4 h-4' />
                            <span>Due now: {dueCount}</span>
                        </div>
                    </div>
                )}

                {/* Next review indicator - always show if available */}
                {deck.next_review_time && (
                    <div className='pt-2 border-t border-border'>
                        <div className='flex items-center justify-between text-sm text-muted-foreground'>
                            <span>Next review:</span>
                            <span className={isCountdownActive ? 'text-green-400 font-medium animate-pulse' : 'text-blue-400'}>
                                {isCountdownActive && countdown !== null
                                    ? formatCountdown(countdown)
                                    : formatNextReviewTime(new Date(deck.next_review_time))
                                }
                            </span>
                        </div>
                    </div>
                )}

                {/* Total studied */}
                {(deck.total_studied || 0) > 0 && (
                    <div className={`${dueCount > 0 ? '' : 'pt-2 border-t border-border'}`}>
                        <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                            <BookOpen className='w-4 h-4' />
                            <span>Studied: {deck.total_studied}</span>
                        </div>
                    </div>
                )}

                <Button
                    onClick={() => onStudy(deck.id)}
                    className='w-full'
                    disabled={studyCount === 0}>
                    {studyCount > 0
                        ? `Study Now (${studyCount} cards)`
                        : 'No cards due'}
                </Button>
            </CardContent>
        </Card>
    );
}
