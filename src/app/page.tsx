'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DeckCard } from '@/components/Dashboard/DeckCard';
import { Deck, DeckDisplayInfo } from '@/types';
import { getDecks, getDeckDisplayInfo } from '@/lib/database';

export default function Home() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [displayDecks, setDisplayDecks] = useState<DeckDisplayInfo[]>([]);
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const router = useRouter();

  const loadDecks = async () => {
    try {
      const savedDecks = await getDecks();
      setDecks(savedDecks);
      const displayInfo = savedDecks.map(deck => getDeckDisplayInfo(deck));
      setDisplayDecks(displayInfo);
      setLastUpdate(Date.now());
    } catch (error) {
      console.error('Error loading decks:', error);
    }
  };

  useEffect(() => {
    loadDecks();
  }, []);

  // Auto-refresh mechanism
  useEffect(() => {
    const interval = setInterval(() => {
      loadDecks();
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, []);

  const handleStudy = (deckId: string) => {
    router.push(`/study/${deckId}`);
  };

  return (
    <div className="min-h-screen bg-gray-900 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            Zikr
          </h1>
          <p className="text-gray-300">
            Learn Arabic through spaced repetition
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayDecks.map((deck) => (
            <DeckCard
              key={deck.id}
              deck={deck}
              onStudy={handleStudy}
            />
          ))}
        </div>

        {displayDecks.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-400">Loading decks...</p>
          </div>
        )}
      </div>
    </div>
  );
}
