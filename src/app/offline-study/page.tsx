'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { StudySession } from '@/components/StudySession/StudySession';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import ProtectedRoute from '@/components/Auth/ProtectedRoute';
import { useAuth } from '@/contexts/auth';
import { offlineService } from '@/lib/offline';
import type { DeckWithStats } from '@/lib/offline';

function OfflineStudyPageContent() {
    const router = useRouter();
    const { user } = useAuth();
    const [deckId, setDeckId] = useState<string | null>(null);
    const [deckTitle, setDeckTitle] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const initializeOfflineStudy = async () => {
            if (!user) {
                router.push('/login');
                return;
            }

            try {
                // Get deck ID from localStorage
                const storedDeckId = localStorage.getItem('offline-study-deck-id');
                if (!storedDeckId) {
                    setError('No deck selected for offline study');
                    setIsLoading(false);
                    return;
                }

                // Initialize offline service
                await offlineService.init();
                await offlineService.setCurrentUser(user.id);

                // Get deck info
                const decks = await offlineService.getDecks();
                const deck = decks.find(d => d.id === storedDeckId);
                
                if (!deck) {
                    setError('Deck not found in offline storage');
                    setIsLoading(false);
                    return;
                }

                setDeckId(storedDeckId);
                setDeckTitle(deck.title);
                setIsLoading(false);
            } catch (err) {
                console.error('Failed to initialize offline study:', err);
                setError('Failed to load deck data');
                setIsLoading(false);
            }
        };

        initializeOfflineStudy();
    }, [user, router]);

    const handleBack = () => {
        localStorage.removeItem('offline-study-deck-id');
        router.push('/');
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <div className="text-center">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <h1 className="text-xl font-semibold mb-2">Loading Offline Study Session...</h1>
                    <p className="text-muted-foreground">Preparing your cards for review</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <div className="max-w-md w-full">
                    <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                    <Button 
                        onClick={handleBack} 
                        className="w-full mt-4"
                        variant="outline"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Dashboard
                    </Button>
                </div>
            </div>
        );
    }

    if (!deckId || !user) {
        return null;
    }

    return (
        <StudySession
            deckId={deckId}
            deckTitle={deckTitle}
            userId={user.id}
            isOnline={false}
            isOfflineMode={true}
        />
    );
}

export default function OfflineStudyPage() {
    return (
        <ProtectedRoute>
            <OfflineStudyPageContent />
        </ProtectedRoute>
    );
}