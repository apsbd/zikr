import { Deck, Card } from '@/types';
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

  const deck: Deck = {
    id: 'arabic-bangla-basic',
    title: 'Arabic to Bangla - Basic Words',
    description: 'Learn 10 basic Arabic words with Bangla translations',
    cards,
    stats: getCardStats(cards),
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