import type { DeckDisplayInfo, Card } from '@/types';
import type { LocalStorageData } from './sync-manager';

class LocalStorageService {
  private getStorageKey(userId: string): string {
    return `app-data-${userId}`;
  }

  // Load all data from localStorage
  private loadData(userId: string): LocalStorageData | null {
    const key = this.getStorageKey(userId);
    const data = localStorage.getItem(key);
    
    if (!data) return null;
    
    try {
      return JSON.parse(data);
    } catch (error) {
      console.error('Error parsing localStorage data:', error);
      return null;
    }
  }

  // Check if data is initialized
  isInitialized(userId: string): boolean {
    const data = this.loadData(userId);
    return data?.isInitialized ?? false;
  }

  // Get all decks with calculated stats
  getDecks(userId: string): DeckDisplayInfo[] {
    const data = this.loadData(userId);
    if (!data) {
      return [];
    }
    
    // Calculate real-time stats for each deck
    const result = data.decks.map(deck => {
      const stats = this.calculateDeckStats(deck.id, userId);
      return {
        ...deck,
        stats,
        nextReviewCount: stats.due,
        nextReviewTime: stats.nextReviewTime,
      };
    });
    
    return result;
  }

  // Get study cards for a deck
  getStudyCards(deckId: string, userId: string): Card[] {
    const data = this.loadData(userId);
    if (!data) {
      return [];
    }
    
    const cards = data.studyCards[deckId] || [];
    const deck = data.decks.find(d => d.id === deckId);
    const dailyLimit = deck?.dailyNewLimit || 20;
    
    if (cards.length === 0) {
      return [];
    }
    
    // Use the same logic as stats calculation to ensure consistency
    const now = new Date();
    const dueCards: Card[] = [];
    let learningCardsCount = 0;
    let reviewCardsCount = 0;
    let newCardCount = 0;
    
    // First pass: count cards by state and add due review/learning cards
    cards.forEach(card => {
      const progress = data.progress[card.id];
      if (progress) {
        const due = new Date(progress.due);
        const isDue = due <= now;
        
        switch (progress.state) {
          case 1: // Learning
          case 3: // Relearning
            learningCardsCount++;
            if (isDue) {
              dueCards.push({
                ...card,
                fsrsData: {
                  ...progress,
                  due,
                  last_review: progress.last_review ? new Date(progress.last_review) : undefined,
                },
              });
            }
            break;
          case 2: // Review
            reviewCardsCount++;
            if (isDue) {
              dueCards.push({
                ...card,
                fsrsData: {
                  ...progress,
                  due,
                  last_review: progress.last_review ? new Date(progress.last_review) : undefined,
                },
              });
            }
            break;
        }
      }
    });
    
    // Calculate remaining new card quota (same logic as stats)
    const cardsWithProgress = learningCardsCount + reviewCardsCount;
    const remainingNewCardQuota = Math.max(0, dailyLimit - cardsWithProgress);
    
    // Second pass: add new cards up to remaining quota
    cards.forEach(card => {
      const progress = data.progress[card.id];
      if (!progress && newCardCount < remainingNewCardQuota) {
        dueCards.push(card);
        newCardCount++;
      }
    });
    
    return dueCards;
  }

  // Calculate deck stats
  private calculateDeckStats(deckId: string, userId: string): any {
    const data = this.loadData(userId);
    if (!data) return { total: 0, new: 0, learning: 0, review: 0, due: 0 };
    
    const cards = data.studyCards[deckId] || [];
    const deck = data.decks.find(d => d.id === deckId);
    const dailyLimit = deck?.dailyNewLimit || 20;
    
    if (cards.length === 0) {
      return { total: 0, new: 0, learning: 0, review: 0, due: 0 };
    }
    
    const now = new Date();
    let newCards = 0;
    let learningCards = 0;
    let reviewCards = 0;
    let dueCards = 0;
    let nextReviewTime: Date | null = null;
    
    cards.forEach(card => {
      const progress = data.progress[card.id];
      
      if (!progress) {
        // No progress = new card
        newCards++;
        return;
      }
      
      const due = new Date(progress.due);
      const isDue = due <= now;
      
      switch (progress.state) {
        case 0: // New
          newCards++;
          if (isDue) {
            dueCards++;
          }
          break;
        case 1: // Learning
        case 3: // Relearning
          learningCards++;
          if (isDue) {
            dueCards++;
          } else {
            // Track earliest future due time
            if (!nextReviewTime || due < nextReviewTime) {
              nextReviewTime = due;
            }
          }
          break;
        case 2: // Review
          reviewCards++;
          if (isDue) {
            dueCards++;
          } else {
            // Track earliest future due time
            if (!nextReviewTime || due < nextReviewTime) {
              nextReviewTime = due;
            }
          }
          break;
      }
    });
    
    // Calculate how many cards have progress (were studied at some point)
    const cardsWithProgress = learningCards + reviewCards;
    const remainingNewCardQuota = Math.max(0, dailyLimit - cardsWithProgress);
    const newCardsDue = Math.min(newCards, remainingNewCardQuota);
    dueCards += newCardsDue;
    
    const stats = {
      total: cards.length,
      new: newCards,
      learning: learningCards,
      review: reviewCards,
      due: dueCards,
      nextReviewTime,
    };
    
    return stats;
  }

  // Get card progress
  getCardProgress(cardId: string, userId: string): any | null {
    const data = this.loadData(userId);
    if (!data) return null;
    
    const progress = data.progress[cardId];
    if (!progress) return null;
    
    return {
      ...progress,
      due: new Date(progress.due),
      last_review: progress.last_review ? new Date(progress.last_review) : undefined,
    };
  }

  // Save card progress (handled by sync manager)
  // Note: This method is deprecated, use syncManager.saveCardProgress directly
  saveCardProgress(cardId: string, userId: string, fsrsData: any): void {
    // Deprecated - use syncManager.saveCardProgress directly
  }

  // Clear all data for user
  clearUserData(userId: string): void {
    const key = this.getStorageKey(userId);
    localStorage.removeItem(key);
  }
}

export const localStorageService = new LocalStorageService();