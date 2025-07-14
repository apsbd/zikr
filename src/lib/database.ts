import { supabase, type DbDeck, type DbCard } from './supabase';
import { initializeFSRSCard, getCardStats } from './fsrs';
import type { Deck, Card, DeckDisplayInfo } from '@/types';

// Convert database deck to app deck format
function dbDeckToAppDeck(dbDeck: DbDeck, dbCards: DbCard[]): Deck {
  const cards: Card[] = dbCards.map(dbCard => {
    // Get user progress from localStorage
    const progressKey = `card-progress-${dbCard.id}`;
    const savedProgress = localStorage.getItem(progressKey);
    
    let fsrsData;
    if (savedProgress) {
      try {
        const progress = JSON.parse(savedProgress);
        fsrsData = {
          ...progress,
          due: new Date(progress.due),
          last_review: progress.last_review ? new Date(progress.last_review) : undefined,
        };
      } catch (error) {
        console.error('Error parsing card progress:', error);
        fsrsData = initializeFSRSCard();
      }
    } else {
      fsrsData = initializeFSRSCard();
    }

    return {
      id: dbCard.id,
      front: dbCard.front,
      back: {
        bangla: dbCard.back_bangla,
        english: dbCard.back_english,
      },
      fsrsData,
    };
  });

  return {
    id: dbDeck.id,
    title: dbDeck.title,
    description: dbDeck.description || '',
    author: dbDeck.author,
    cards,
    stats: getCardStats(cards),
    createdAt: new Date(dbDeck.created_at),
    updatedAt: new Date(dbDeck.updated_at),
  };
}

// Get all decks from Supabase
export async function getDecks(): Promise<Deck[]> {
  try {
    // Fetch decks
    const { data: decks, error: decksError } = await supabase
      .from('decks')
      .select('*')
      .order('created_at', { ascending: false });

    if (decksError) {
      console.error('Error fetching decks:', decksError);
      return [];
    }

    // Fetch all cards
    const { data: cards, error: cardsError } = await supabase
      .from('cards')
      .select('*')
      .order('created_at', { ascending: true });

    if (cardsError) {
      console.error('Error fetching cards:', cardsError);
      return [];
    }

    // Group cards by deck_id and convert to app format
    const decksWithCards: Deck[] = decks.map(deck => {
      const deckCards = cards.filter(card => card.deck_id === deck.id);
      return dbDeckToAppDeck(deck, deckCards);
    });

    return decksWithCards;
  } catch (error) {
    console.error('Error in getDecks:', error);
    return [];
  }
}

// Get a specific deck by ID
export async function getDeckById(id: string): Promise<Deck | undefined> {
  try {
    // Fetch deck
    const { data: deck, error: deckError } = await supabase
      .from('decks')
      .select('*')
      .eq('id', id)
      .single();

    if (deckError || !deck) {
      console.error('Error fetching deck:', deckError);
      return undefined;
    }

    // Fetch cards for this deck
    const { data: cards, error: cardsError } = await supabase
      .from('cards')
      .select('*')
      .eq('deck_id', id)
      .order('created_at', { ascending: true });

    if (cardsError) {
      console.error('Error fetching cards:', cardsError);
      return undefined;
    }

    return dbDeckToAppDeck(deck, cards || []);
  } catch (error) {
    console.error('Error in getDeckById:', error);
    return undefined;
  }
}

// Save deck to Supabase (create or update)
export async function saveDeck(deck: Deck): Promise<boolean> {
  try {
    // Check if deck exists
    const { data: existingDeck } = await supabase
      .from('decks')
      .select('id')
      .eq('id', deck.id)
      .single();

    const deckData = {
      id: deck.id,
      title: deck.title,
      description: deck.description,
      author: deck.author,
      updated_at: new Date().toISOString(),
    };

    if (existingDeck) {
      // Update existing deck
      const { error: deckError } = await supabase
        .from('decks')
        .update(deckData)
        .eq('id', deck.id);

      if (deckError) {
        console.error('Error updating deck:', deckError);
        return false;
      }
    } else {
      // Create new deck
      const { error: deckError } = await supabase
        .from('decks')
        .insert({
          ...deckData,
          created_at: new Date().toISOString(),
        });

      if (deckError) {
        console.error('Error creating deck:', deckError);
        return false;
      }
    }

    // Get existing cards for this deck
    const { data: existingCards } = await supabase
      .from('cards')
      .select('id')
      .eq('deck_id', deck.id);

    const existingCardIds = existingCards?.map(card => card.id) || [];
    const currentCardIds = deck.cards.map(card => card.id);

    // Delete cards that are no longer in the deck
    const cardsToDelete = existingCardIds.filter(id => !currentCardIds.includes(id));
    if (cardsToDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from('cards')
        .delete()
        .in('id', cardsToDelete);

      if (deleteError) {
        console.error('Error deleting cards:', deleteError);
      }
    }

    // Upsert cards
    const cardsData = deck.cards.map(card => ({
      id: card.id,
      deck_id: deck.id,
      front: card.front,
      back_bangla: card.back.bangla,
      back_english: card.back.english,
      updated_at: new Date().toISOString(),
    }));

    if (cardsData.length > 0) {
      const { error: cardsError } = await supabase
        .from('cards')
        .upsert(cardsData);

      if (cardsError) {
        console.error('Error saving cards:', cardsError);
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('Error in saveDeck:', error);
    return false;
  }
}

// Save user progress for a card to localStorage
export function saveCardProgress(cardId: string, fsrsData: Card['fsrsData']): void {
  try {
    const progressKey = `card-progress-${cardId}`;
    localStorage.setItem(progressKey, JSON.stringify(fsrsData));
  } catch (error) {
    console.error('Error saving card progress:', error);
  }
}

// Delete a deck from Supabase
export async function deleteDeck(deckId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('decks')
      .delete()
      .eq('id', deckId);

    if (error) {
      console.error('Error deleting deck:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in deleteDeck:', error);
    return false;
  }
}

// Helper functions for the app
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