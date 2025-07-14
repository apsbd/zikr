'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DeckCard } from '@/components/Dashboard/DeckCard';
import { Deck } from '@/types';
import { getDecks } from '@/lib/data';

export default function Home() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const router = useRouter();

  useEffect(() => {
    const loadDecks = () => {
      const savedDecks = getDecks();
      setDecks(savedDecks);
    };

    loadDecks();
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
          {decks.map((deck) => (
            <DeckCard
              key={deck.id}
              deck={deck}
              onStudy={handleStudy}
            />
          ))}
        </div>

        {decks.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-400">Loading decks...</p>
          </div>
        )}
      </div>
    </div>
  );
}
