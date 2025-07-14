'use client';

import { useState, useEffect } from 'react';
import { Card as CardType, Rating } from '@/types';
import { cn } from '@/lib/utils';
import { ZoomIn, ZoomOut } from 'lucide-react';

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
    const [textSize, setTextSize] = useState(1); // 1 = normal, 1.2 = larger, 0.8 = smaller

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

    const handleZoomIn = (e: React.MouseEvent) => {
        e.stopPropagation();
        setTextSize(prev => Math.min(prev + 0.2, 2)); // Max 2x size
    };

    const handleZoomOut = (e: React.MouseEvent) => {
        e.stopPropagation();
        setTextSize(prev => Math.max(prev - 0.2, 0.6)); // Min 0.6x size
    };

    return (
        <div className='w-full max-w-lg mx-auto'>
            {/* Zoom Controls */}
            <div className='flex justify-end gap-2 mb-4'>
                <button
                    onClick={handleZoomOut}
                    className='bg-white/10 hover:bg-white/20 text-purple-200 border border-white/30 rounded-xl p-2 transition-all duration-300 hover:scale-105 backdrop-blur-sm'
                    title='Zoom Out'>
                    <ZoomOut className='w-5 h-5' />
                </button>
                <button
                    onClick={handleZoomIn}
                    className='bg-white/10 hover:bg-white/20 text-purple-200 border border-white/30 rounded-xl p-2 transition-all duration-300 hover:scale-105 backdrop-blur-sm'
                    title='Zoom In'>
                    <ZoomIn className='w-5 h-5' />
                </button>
            </div>

            <div
                className='flip-container min-h-[400px]'
                onClick={
                    !isFlipped && showFrontContent ? handleFlip : undefined
                }>
                <div
                    className={cn(
                        'flip-card min-h-[400px]',
                        isFlipped && 'flipped',
                        isFirstRender && 'no-transition'
                    )}>
                    {/* Front of card */}
                    <div className='flip-card-front'>
                        <div className='space-y-6 p-8 flex flex-col items-center justify-center h-full'>
                            <div 
                                className='study-card-arabic arabic-text text-white text-4xl font-bold text-center transition-all duration-300'
                                style={{ fontSize: `${textSize * 2.25}rem` }}>
                                {showFrontContent ? card.front : ''}
                            </div>
                            {showFrontContent && (
                                <div className='text-center space-y-2'>
                                    <p className='text-purple-200 text-lg font-medium'>
                                        Tap to reveal answer
                                    </p>
                                    <div className='animate-bounce'>
                                        <span className='text-2xl'>👆</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Back of card */}
                    <div className='flip-card-back'>
                        <div className='space-y-8 w-full p-8 flex flex-col items-center justify-center h-full'>
                            {showBackContent ? (
                                <div className='space-y-6 text-center w-full'>
                                    <div 
                                        className='study-card-translation text-blue-200 font-bold text-2xl transition-all duration-300'
                                        style={{ fontSize: `${textSize * 1.5}rem` }}>
                                        {card.back.bangla}
                                    </div>
                                    <div 
                                        className='study-card-translation text-purple-200 font-semibold text-xl transition-all duration-300'
                                        style={{ fontSize: `${textSize * 1.25}rem` }}>
                                        {card.back.english}
                                    </div>
                                </div>
                            ) : (
                                <div className='text-purple-300 text-2xl animate-pulse'>•••</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {isFlipped && showBackContent && (
                <div className='mt-8 grid grid-cols-4 gap-4 button-container'>
                    <button
                        onClick={() => handleRate(Rating.Again)}
                        className='bg-red-500/20 hover:bg-red-500/30 text-red-200 border border-red-400/30 rounded-xl p-4 font-bold text-lg transition-all duration-300 hover:scale-105 hover:shadow-lg flex flex-col items-center gap-2'>
                        <span className='text-2xl'>😰</span>
                        Again
                    </button>
                    <button
                        onClick={() => handleRate(Rating.Hard)}
                        className='bg-orange-500/20 hover:bg-orange-500/30 text-orange-200 border border-orange-400/30 rounded-xl p-4 font-bold text-lg transition-all duration-300 hover:scale-105 hover:shadow-lg flex flex-col items-center gap-2'>
                        <span className='text-2xl'>😓</span>
                        Hard
                    </button>
                    <button
                        onClick={() => handleRate(Rating.Good)}
                        className='bg-green-500/20 hover:bg-green-500/30 text-green-200 border border-green-400/30 rounded-xl p-4 font-bold text-lg transition-all duration-300 hover:scale-105 hover:shadow-lg flex flex-col items-center gap-2'>
                        <span className='text-2xl'>😊</span>
                        Good
                    </button>
                    <button
                        onClick={() => handleRate(Rating.Easy)}
                        className='bg-blue-500/20 hover:bg-blue-500/30 text-blue-200 border border-blue-400/30 rounded-xl p-4 font-bold text-lg transition-all duration-300 hover:scale-105 hover:shadow-lg flex flex-col items-center gap-2'>
                        <span className='text-2xl'>🤩</span>
                        Easy
                    </button>
                </div>
            )}
        </div>
    );
}
