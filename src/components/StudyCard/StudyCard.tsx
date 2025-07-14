'use client';

import { useState, useEffect } from 'react';
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
    const [showFrontContent, setShowFrontContent] = useState(false);
    const [showBackContent, setShowBackContent] = useState(false);
    const [currentCardId, setCurrentCardId] = useState(card.id);

    // Reset flip state when card changes with proper timing
    useEffect(() => {
        // Only reset if it's actually a new card
        if (card.id !== currentCardId) {
            // Hide ALL content immediately
            setShowFrontContent(false);
            setShowBackContent(false);

            // Reset flip state IMMEDIATELY
            setIsFlipped(false);
            setIsFirstRender(false);
            setCurrentCardId(card.id);

            // Show only front content after a brief delay
            const timer = setTimeout(() => {
                setShowFrontContent(true);
                // Back content remains hidden until flip
            }, 50);

            return () => clearTimeout(timer);
        } else {
            // First render of same card
            setShowFrontContent(true);
            setIsFirstRender(false);
        }
    }, [card.id, currentCardId]);

    const handleFlip = () => {
        setIsFlipped(true);
        // Only show back content AFTER flip animation starts
        setTimeout(() => {
            setShowBackContent(true);
        }, 150); // Half way through the 300ms flip animation
    };

    const handleRate = (rating: Rating) => {
        // Hide back content before rating to prevent flash on next card
        setShowBackContent(false);
        onRate(rating);
    };

    return (
        <div className='w-full max-w-md mx-auto'>
            <div
                className='flip-container min-h-[300px]'
                onClick={
                    !isFlipped && showFrontContent ? handleFlip : undefined
                }>
                <div
                    className={cn(
                        'flip-card min-h-[300px]',
                        isFlipped && 'flipped',
                        isFirstRender && 'no-transition'
                    )}>
                    {/* Front of card */}
                    <div className='flip-card-front'>
                        <div className='space-y-4'>
                            <div className='study-card-arabic arabic-text text-white'>
                                {showFrontContent ? card.front : ''}
                            </div>
                            {showFrontContent && (
                                <p className='text-gray-400 text-sm'>
                                    Tap to reveal answer
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Back of card */}
                    <div className='flip-card-back'>
                        <div className='space-y-6 w-full'>
                            {showBackContent ? (
                                <div className='space-y-3'>
                                    <div className='study-card-translation text-gray-200 font-semibold'>
                                        {card.back.bangla}
                                    </div>
                                    <div className='study-card-translation text-gray-300'>
                                        {card.back.english}
                                    </div>
                                </div>
                            ) : (
                                <div className='text-gray-500'>•••</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {isFlipped && showBackContent && (
                <div className='mt-6 grid grid-cols-2 gap-3 button-container'>
                    <button
                        onClick={() => handleRate(Rating.Again)}
                        className='btn-again'>
                        Again
                    </button>
                    <button
                        onClick={() => handleRate(Rating.Hard)}
                        className='btn-hard'>
                        Hard
                    </button>
                    <button
                        onClick={() => handleRate(Rating.Good)}
                        className='btn-good'>
                        Good
                    </button>
                    <button
                        onClick={() => handleRate(Rating.Easy)}
                        className='btn-easy'>
                        Easy
                    </button>
                </div>
            )}
        </div>
    );
}
