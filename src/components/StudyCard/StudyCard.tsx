'use client';

import { useState, useEffect } from 'react';
import { Card as CardType, Rating } from '@/types';
import { cn } from '@/lib/utils';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

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
    const [textSize, setTextSize] = useState(() => {
        // Load from localStorage or default to 1
        if (typeof window !== 'undefined') {
            const savedSize = localStorage.getItem('study-card-zoom');
            return savedSize ? parseFloat(savedSize) : 1;
        }
        return 1;
    }); // 1 = current size, up to 3 = 3x size

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
        setTextSize(prev => {
            const newSize = Math.min(prev + 0.2, 3); // Max 3x size
            localStorage.setItem('study-card-zoom', newSize.toString());
            return newSize;
        });
    };

    const handleZoomOut = (e: React.MouseEvent) => {
        e.stopPropagation();
        setTextSize(prev => {
            const newSize = Math.max(prev - 0.2, 1); // Min 1x size (current size)
            localStorage.setItem('study-card-zoom', newSize.toString());
            return newSize;
        });
    };

    return (
        <div className='w-full max-w-lg mx-auto'>
            {/* Zoom Controls */}
            <div className='flex justify-end gap-2 mb-4'>
                <Button
                    onClick={handleZoomOut}
                    variant="outline"
                    size="icon"
                    title='Zoom Out'>
                    <ZoomOut className='w-4 h-4' />
                </Button>
                <Button
                    onClick={handleZoomIn}
                    variant="outline"
                    size="icon"
                    title='Zoom In'>
                    <ZoomIn className='w-4 h-4' />
                </Button>
            </div>

            <Card 
                className='min-h-[400px] cursor-pointer hover:shadow-lg transition-shadow'
                onClick={!isFlipped && showFrontContent ? handleFlip : undefined}>
                <div className='p-8 flex flex-col items-center justify-center h-full min-h-[400px]'>
                    {!isFlipped ? (
                        <div className='space-y-6 text-center'>
                            <div 
                                className='font-bold text-center transition-all duration-300 arabic-text-large'
                                style={{ 
                                    fontSize: `${textSize * 2.25}rem`
                                }}>
                                {showFrontContent ? card.front : ''}
                            </div>
                            {showFrontContent && (
                                <div className='text-center space-y-2'>
                                    <p className='text-muted-foreground text-lg font-medium'>
                                        Tap to reveal answer
                                    </p>
                                    <div className='animate-bounce'>
                                        <span className='text-2xl'>👆</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className='space-y-8 w-full text-center'>
                            {showBackContent ? (
                                <div className='space-y-6'>
                                    <div 
                                        className='font-bold text-primary transition-all duration-300'
                                        style={{ fontSize: `${textSize * 1.5}rem` }}>
                                        {card.back.bangla}
                                    </div>
                                    <div 
                                        className='font-semibold text-muted-foreground transition-all duration-300'
                                        style={{ fontSize: `${textSize * 1.25}rem` }}>
                                        {card.back.english}
                                    </div>
                                </div>
                            ) : (
                                <div className='text-muted-foreground text-2xl animate-pulse'>•••</div>
                            )}
                        </div>
                    )}
                </div>
            </Card>

            {isFlipped && showBackContent && (
                <div className='mt-8 grid grid-cols-4 gap-4'>
                    <Button
                        onClick={() => handleRate(Rating.Again)}
                        className='h-auto p-4 flex flex-col items-center gap-2 bg-red-600 hover:bg-red-700 text-white'>
                        <span className='text-2xl'>😰</span>
                        Again
                    </Button>
                    <Button
                        onClick={() => handleRate(Rating.Hard)}
                        className='h-auto p-4 flex flex-col items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white'>
                        <span className='text-2xl'>😓</span>
                        Hard
                    </Button>
                    <Button
                        onClick={() => handleRate(Rating.Good)}
                        className='h-auto p-4 flex flex-col items-center gap-2 bg-green-600 hover:bg-green-700 text-white'>
                        <span className='text-2xl'>😊</span>
                        Good
                    </Button>
                    <Button
                        onClick={() => handleRate(Rating.Easy)}
                        className='h-auto p-4 flex flex-col items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white'>
                        <span className='text-2xl'>🤩</span>
                        Easy
                    </Button>
                </div>
            )}
        </div>
    );
}
