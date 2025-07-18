import { IndexedDBService } from './indexeddb-service';
import { STORE_NAMES } from './indexeddb-schema';
import type {
  OfflineDeck,
  OfflineCard,
  OfflineUserProgress,
  OfflineUserProfile,
  OfflineDeckUserAccess,
  DeckWithStats,
  StudySession,
  OfflineCapabilities
} from './types';

export class OfflineDataService {
  private static instance: OfflineDataService;
  private db: IndexedDBService;
  private currentUser: string | null = null;

  private constructor() {
    this.db = IndexedDBService.getInstance();
  }

  static getInstance(): OfflineDataService {
    if (!OfflineDataService.instance) {
      OfflineDataService.instance = new OfflineDataService();
    }
    return OfflineDataService.instance;
  }

  async init(): Promise<void> {
    await this.db.init();
    
    this.currentUser = await this.db.getMetadata('current_user_id');
    
    if (!this.currentUser) {
      console.warn('No current user found in offline storage');
    }
  }

  async setCurrentUser(userId: string): Promise<void> {
    this.currentUser = userId;
    await this.db.setMetadata('current_user_id', userId);
  }

  async getCurrentUser(): Promise<string | null> {
    return this.currentUser;
  }

  async clearCurrentUser(): Promise<void> {
    this.currentUser = null;
    await this.db.setMetadata('current_user_id', null);
  }

  async clearStore(storeName: string): Promise<void> {
    await this.db.clear(storeName as any);
  }


  async getOfflineCapabilities(): Promise<OfflineCapabilities> {
    const [syncQueue, lastSync] = await Promise.all([
      this.db.getSyncQueue(),
      this.db.getMetadata('last_successful_sync')
    ]);

    return {
      isOnline: navigator.onLine,
      hasLocalData: await this.hasLocalData(),
      pendingSyncCount: syncQueue.length,
      lastSuccessfulSync: lastSync,
      nextScheduledSync: await this.db.getMetadata('next_scheduled_sync')
    };
  }

  private async hasLocalData(): Promise<boolean> {
    const [decks, cards, progress] = await Promise.all([
      this.db.getAll<OfflineDeck>(STORE_NAMES.DECKS),
      this.db.getAll<OfflineCard>(STORE_NAMES.CARDS),
      this.db.getAll<OfflineUserProgress>(STORE_NAMES.USER_PROGRESS)
    ]);

    return decks.length > 0 || cards.length > 0 || progress.length > 0;
  }

  async getDecks(): Promise<DeckWithStats[]> {
    if (!this.currentUser) {
      throw new Error('No current user set');
    }

    console.log('🔍 Getting decks for user:', this.currentUser);
    const decks = await this.db.getUserDecks(this.currentUser);
    console.log('🔍 Retrieved decks:', decks.length, 'decks');
    if (decks.length > 0) {
      console.log('🔍 Sample deck:', decks[0]);
    }
    return decks;
  }

  async getDeck(deckId: string): Promise<DeckWithStats | undefined> {
    if (!this.currentUser) {
      throw new Error('No current user set');
    }

    return await this.db.getDeckWithStats(deckId, this.currentUser);
  }

  async getDeckCards(deckId: string): Promise<OfflineCard[]> {
    return await this.db.getByIndex<OfflineCard>(
      STORE_NAMES.CARDS,
      'deck_id',
      deckId
    );
  }

  async getCard(cardId: string): Promise<OfflineCard | undefined> {
    return await this.db.get<OfflineCard>(STORE_NAMES.CARDS, cardId);
  }

  async getUserProgress(userId: string, cardId: string): Promise<OfflineUserProgress | undefined> {
    const progressList = await this.db.getByIndex<OfflineUserProgress>(
      STORE_NAMES.USER_PROGRESS,
      'user_card',
      [userId, cardId]
    );

    return progressList[0];
  }

  async updateUserProgress(progress: OfflineUserProgress): Promise<OfflineUserProgress> {
    try {
      // Check if progress already exists for this user-card combination
      const existingProgress = await this.getUserProgress(progress.user_id, progress.card_id);
      
      if (existingProgress) {
        // Use the existing record's ID to avoid unique constraint violation
        const updatedProgress = {
          ...progress,
          id: existingProgress.id,
          created_at: existingProgress.created_at, // Keep original creation time
          updated_at: new Date().toISOString()
        };
        console.log(`Updating existing progress for user ${progress.user_id}, card ${progress.card_id}`);
        return await this.db.put(STORE_NAMES.USER_PROGRESS, updatedProgress);
      } else {
        // Create new progress record
        console.log(`Creating new progress for user ${progress.user_id}, card ${progress.card_id}`);
        return await this.db.put(STORE_NAMES.USER_PROGRESS, progress);
      }
    } catch (error) {
      console.error('Error updating user progress:', error);
      // If there's still a constraint error, it might be due to race conditions
      // Try to fetch the existing record again and update it
      try {
        const existingProgress = await this.getUserProgress(progress.user_id, progress.card_id);
        if (existingProgress) {
          const updatedProgress = {
            ...progress,
            id: existingProgress.id,
            created_at: existingProgress.created_at,
            updated_at: new Date().toISOString()
          };
          console.log(`Retrying update for existing progress ${existingProgress.id}`);
          return await this.db.put(STORE_NAMES.USER_PROGRESS, updatedProgress);
        }
      } catch (retryError) {
        console.error('Failed to retry progress update:', retryError);
      }
      throw error;
    }
  }

  async batchUpdateUserProgress(progressList: OfflineUserProgress[]): Promise<OfflineUserProgress[]> {
    return await this.db.putBatch(STORE_NAMES.USER_PROGRESS, progressList);
  }

  async getDueCards(deckId?: string): Promise<OfflineCard[]> {
    if (!this.currentUser) {
      throw new Error('No current user set');
    }

    return await this.db.getDueCards(this.currentUser, deckId);
  }

  async getStudySession(deckId: string): Promise<StudySession> {
    if (!this.currentUser) {
      throw new Error('No current user set');
    }

    const [cards, allProgress] = await Promise.all([
      this.getDeckCards(deckId),
      this.db.getByIndex<OfflineUserProgress>(
        STORE_NAMES.USER_PROGRESS,
        'user_id',
        this.currentUser
      )
    ]);

    const progressMap = new Map(
      allProgress
        .filter(p => cards.some(c => c.id === p.card_id))
        .map(p => [p.card_id, p])
    );

    return {
      deck_id: deckId,
      cards,
      progress: progressMap
    };
  }

  async getNewCards(deckId: string, limit: number = 20): Promise<OfflineCard[]> {
    if (!this.currentUser) {
      throw new Error('No current user set');
    }

    const [cards, userProgress] = await Promise.all([
      this.getDeckCards(deckId),
      this.db.getByIndex<OfflineUserProgress>(
        STORE_NAMES.USER_PROGRESS,
        'user_id',
        this.currentUser
      )
    ]);

    const studiedCardIds = new Set(userProgress.map(p => p.card_id));
    const newCards = cards.filter(card => !studiedCardIds.has(card.id));

    return newCards.slice(0, limit);
  }

  async getReviewCards(deckId: string): Promise<OfflineCard[]> {
    if (!this.currentUser) {
      throw new Error('No current user set');
    }

    const now = new Date().toISOString();
    const dueProgress = await this.db.getByIndex<OfflineUserProgress>(
      STORE_NAMES.USER_PROGRESS,
      'user_due',
      IDBKeyRange.bound([this.currentUser, ''], [this.currentUser, now])
    );

    const dueCardIds = new Set(dueProgress.map(p => p.card_id));
    const deckCards = await this.getDeckCards(deckId);

    return deckCards.filter(card => dueCardIds.has(card.id));
  }

  async createDeck(deck: Omit<OfflineDeck, 'id' | 'created_at' | 'updated_at'>): Promise<OfflineDeck> {
    const newDeck: OfflineDeck = {
      ...deck,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user_id: deck.user_id || this.currentUser || undefined
    };

    return await this.db.put(STORE_NAMES.DECKS, newDeck);
  }

  async updateDeck(deck: OfflineDeck): Promise<OfflineDeck> {
    return await this.db.put(STORE_NAMES.DECKS, {
      ...deck,
      updated_at: new Date().toISOString()
    });
  }

  async deleteDeck(deckId: string): Promise<void> {
    await this.db.delete(STORE_NAMES.DECKS, deckId);
    
    const cards = await this.getDeckCards(deckId);
    await Promise.all(cards.map(card => this.db.delete(STORE_NAMES.CARDS, card.id)));
  }

  async createCard(card: Omit<OfflineCard, 'id' | 'created_at' | 'updated_at'>): Promise<OfflineCard> {
    const newCard: OfflineCard = {
      ...card,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    return await this.db.put(STORE_NAMES.CARDS, newCard);
  }

  async updateCard(card: OfflineCard): Promise<OfflineCard> {
    return await this.db.put(STORE_NAMES.CARDS, {
      ...card,
      updated_at: new Date().toISOString()
    });
  }

  async deleteCard(cardId: string): Promise<void> {
    await this.db.delete(STORE_NAMES.CARDS, cardId);
    
    const progress = await this.db.getByIndex<OfflineUserProgress>(
      STORE_NAMES.USER_PROGRESS,
      'card_id',
      cardId
    );
    
    await Promise.all(progress.map(p => this.db.delete(STORE_NAMES.USER_PROGRESS, p.id)));
  }


  async updateUserProfile(profile: OfflineUserProfile): Promise<OfflineUserProfile> {
    return await this.db.put(STORE_NAMES.USER_PROFILES, profile);
  }

  async getUserProfile(userId: string): Promise<any> {
    const profiles = await this.db.getByIndex(STORE_NAMES.USER_PROFILES, 'user_id', userId);
    return profiles[0]; // Return the first profile (should be unique)
  }

  async hasUserAccess(userId: string, deckId: string): Promise<boolean> {
    const [deck, userAccess, userProfileArray] = await Promise.all([
      this.db.get<OfflineDeck>(STORE_NAMES.DECKS, deckId),
      this.db.getByIndex<OfflineDeckUserAccess>(
        STORE_NAMES.DECK_USER_ACCESS,
        'deck_user',
        [deckId, userId]
      ),
      this.db.getByIndex<OfflineUserProfile>(STORE_NAMES.USER_PROFILES, 'user_id', userId)
    ]);

    const userProfile = userProfileArray[0];

    if (!deck) return false;

    if (deck.is_public) return true;

    if (deck.user_id === userId) return true;

    const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'superuser';
    if (isAdmin) return true;

    if (deck.group_access_enabled && userAccess.length > 0) return true;

    return false;
  }

  async grantUserAccess(deckId: string, userId: string, grantedBy: string): Promise<OfflineDeckUserAccess> {
    const access: OfflineDeckUserAccess = {
      id: crypto.randomUUID(),
      deck_id: deckId,
      user_id: userId,
      granted_by: grantedBy,
      granted_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    return await this.db.put(STORE_NAMES.DECK_USER_ACCESS, access);
  }

  async revokeUserAccess(deckId: string, userId: string): Promise<void> {
    const access = await this.db.getByIndex<OfflineDeckUserAccess>(
      STORE_NAMES.DECK_USER_ACCESS,
      'deck_user',
      [deckId, userId]
    );

    if (access.length > 0) {
      await this.db.delete(STORE_NAMES.DECK_USER_ACCESS, access[0].id);
    }
  }

  async clearAllData(): Promise<void> {
    await Promise.all([
      this.db.clear(STORE_NAMES.DECKS),
      this.db.clear(STORE_NAMES.CARDS),
      this.db.clear(STORE_NAMES.USER_PROGRESS),
      this.db.clear(STORE_NAMES.USER_PROFILES),
      this.db.clear(STORE_NAMES.DECK_USER_ACCESS),
      this.db.clear(STORE_NAMES.SYNC_QUEUE),
      this.db.clear(STORE_NAMES.METADATA)
    ]);
  }

  async exportData(): Promise<{
    decks: OfflineDeck[];
    cards: OfflineCard[];
    progress: OfflineUserProgress[];
    profiles: OfflineUserProfile[];
    access: OfflineDeckUserAccess[];
  }> {
    const [decks, cards, progress, profiles, access] = await Promise.all([
      this.db.getAll<OfflineDeck>(STORE_NAMES.DECKS),
      this.db.getAll<OfflineCard>(STORE_NAMES.CARDS),
      this.db.getAll<OfflineUserProgress>(STORE_NAMES.USER_PROGRESS),
      this.db.getAll<OfflineUserProfile>(STORE_NAMES.USER_PROFILES),
      this.db.getAll<OfflineDeckUserAccess>(STORE_NAMES.DECK_USER_ACCESS)
    ]);

    return { decks, cards, progress, profiles, access };
  }

  async importData(data: {
    decks: OfflineDeck[];
    cards: OfflineCard[];
    progress: OfflineUserProgress[];
    profiles: OfflineUserProfile[];
    access: OfflineDeckUserAccess[];
  }): Promise<void> {
    await Promise.all([
      this.db.putBatch(STORE_NAMES.DECKS, data.decks, true),
      this.db.putBatch(STORE_NAMES.CARDS, data.cards, true),
      this.db.putBatch(STORE_NAMES.USER_PROGRESS, data.progress, true),
      this.db.putBatch(STORE_NAMES.USER_PROFILES, data.profiles, true),
      this.db.putBatch(STORE_NAMES.DECK_USER_ACCESS, data.access, true)
    ]);
  }
}