import { Deck, Card, DeckDisplayInfo } from '@/types';
import { initializeFSRSCard, getCardStats } from './fsrs';

const arabicWords: Array<{ arabic: string; bangla: string; english: string }> = [
  { arabic: 'كِتَابٌ', bangla: 'কিতাব', english: 'Book' },
  { arabic: 'قَلَمٌ', bangla: 'কলম', english: 'Pen' },
  { arabic: 'بَيْتٌ', bangla: 'ঘর', english: 'House' },
  { arabic: 'مَاءٌ', bangla: 'পানি', english: 'Water' },
  { arabic: 'طَعَامٌ', bangla: 'খাবার', english: 'Food' },
  { arabic: 'بَابٌ', bangla: 'দরজা', english: 'Door' },
  { arabic: 'شَمْسٌ', bangla: 'সূর্য', english: 'Sun' },
  { arabic: 'قَمَرٌ', bangla: 'চাঁদ', english: 'Moon' },
  { arabic: 'وَرْدٌ', bangla: 'ফুল', english: 'Rose/Flower' },
  { arabic: 'طَالِبٌ', bangla: 'ছাত্র', english: 'Student' },
];

export function createDefaultDeck(): Deck {
  const cards: Card[] = arabicWords.map((word, index) => {
    const fsrsCard = initializeFSRSCard();
    return {
      id: `card-${index + 1}`,
      front: word.arabic,
      back: {
        bangla: word.bangla,
        english: word.english,
      },
      fsrsData: {
        due: fsrsCard.due,
        stability: fsrsCard.stability,
        difficulty: fsrsCard.difficulty,
        elapsed_days: fsrsCard.elapsed_days,
        scheduled_days: fsrsCard.scheduled_days,
        reps: fsrsCard.reps,
        lapses: fsrsCard.lapses,
        state: fsrsCard.state,
        last_review: fsrsCard.last_review,
      },
    };
  });

  const now = new Date();
  const deck: Deck = {
    id: 'arabic-bangla-basic',
    title: 'Arabic to Bangla - Basic Words',
    description: 'Learn 10 basic Arabic words with Bangla translations',
    author: 'System',
    cards,
    stats: getCardStats(cards),
    createdAt: now,
    updatedAt: now,
  };

  return deck;
}

export function getDecks(): Deck[] {
  if (typeof window === 'undefined') {
    return [createDefaultDeck()];
  }
  
  const storedDecks = localStorage.getItem('zikr-decks');
  if (storedDecks) {
    try {
      const decks = JSON.parse(storedDecks);
      return decks.map((deck: any) => ({
        ...deck,
        cards: deck.cards.map((card: any) => ({
          ...card,
          fsrsData: {
            ...card.fsrsData,
            due: new Date(card.fsrsData.due),
            last_review: card.fsrsData.last_review ? new Date(card.fsrsData.last_review) : undefined,
          }
        }))
      }));
    } catch (error) {
      console.error('Error parsing stored decks:', error);
    }
  }
  
  const defaultDeck = createDefaultDeck();
  localStorage.setItem('zikr-decks', JSON.stringify([defaultDeck]));
  return [defaultDeck];
}

export function saveDeck(deck: Deck) {
  if (typeof window === 'undefined') {
    return;
  }
  
  const decks = getDecks();
  const index = decks.findIndex(d => d.id === deck.id);
  if (index >= 0) {
    decks[index] = deck;
  } else {
    decks.push(deck);
  }
  localStorage.setItem('zikr-decks', JSON.stringify(decks));
}

export function getDeckById(id: string): Deck | undefined {
  const decks = getDecks();
  return decks.find(deck => deck.id === id);
}

export function getNextReviewTime(cards: Card[]): Date | null {
  const now = new Date();
  const futureCards = cards.filter(card => card.fsrsData.due > now);
  
  if (futureCards.length === 0) return null;
  
  return futureCards.reduce((earliest, card) => 
    card.fsrsData.due < earliest ? card.fsrsData.due : earliest, 
    futureCards[0].fsrsData.due
  );
}

export function getNextReviewCount(cards: Card[], nextTime: Date | null): number {
  if (!nextTime) return 0;
  
  return cards.filter(card => 
    Math.abs(card.fsrsData.due.getTime() - nextTime.getTime()) < 60000 // Within 1 minute
  ).length;
}

export function getDeckDisplayInfo(deck: Deck): DeckDisplayInfo {
  const nextReviewTime = getNextReviewTime(deck.cards);
  const nextReviewCount = getNextReviewCount(deck.cards, nextReviewTime);
  
  return {
    id: deck.id,
    title: deck.title,
    description: deck.description,
    author: deck.author,
    stats: deck.stats,
    nextReviewTime,
    nextReviewCount,
    cards: deck.cards,
  };
}

export function formatNextReviewTime(date: Date): string {
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  
  if (diff <= 0) return 'Ready now';
  
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (minutes < 60) {
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
  } else if (hours < 24) {
    return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  } else if (days === 1) {
    return 'Tomorrow';
  } else {
    return `${days} days`;
  }
}

export function getTimeIndicatorClass(date: Date): string {
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  
  if (minutes <= 0) return 'text-green-400';
  if (minutes < 60) return 'text-yellow-400';
  if (minutes < 24 * 60) return 'text-blue-400';
  return 'text-gray-400';
}