import { OfflineDataService } from './offline-data-service';
import { SyncEngine } from './sync-engine';
import { SyncQueueManager } from './sync-queue';
import type { 
  DeckWithStats, 
  OfflineCard, 
  OfflineUserProgress, 
  StudySession,
  OfflineCapabilities,
  SyncResult
} from './types';
import { Card as CardType } from '@/types';

export class OfflineService {
  private static instance: OfflineService;
  private dataService: OfflineDataService;
  private syncEngine: SyncEngine;
  private syncQueue: SyncQueueManager;
  private isInitialized = false;
  private loginPromise: Promise<SyncResult> | null = null;

  private constructor() {
    this.dataService = OfflineDataService.getInstance();
    this.syncEngine = SyncEngine.getInstance();
    this.syncQueue = SyncQueueManager.getInstance();
  }

  static getInstance(): OfflineService {
    if (!OfflineService.instance) {
      OfflineService.instance = new OfflineService();
    }
    return OfflineService.instance;
  }

  async init(): Promise<void> {
    if (this.isInitialized) return;

    console.log('Initializing offline service...');
    
    try {
      await Promise.all([
        this.dataService.init(),
        this.syncEngine.init()
      ]);

      this.setupAutoSync();
      this.isInitialized = true;
      
      console.log('Offline service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize offline service:', error);
      throw error;
    }
  }

  private setupAutoSync(): void {
    this.syncEngine.scheduleBackgroundSync();
    
    this.syncQueue.schedulePeriodicSync();
  }

  async login(userId: string, isExplicitLogin: boolean = true): Promise<SyncResult> {
    // Return existing login promise if already in progress
    if (this.loginPromise) {
      console.log('Login already in progress, waiting for completion');
      return this.loginPromise;
    }
    
    // Set current user immediately to avoid "No current user set" errors
    await this.dataService.setCurrentUser(userId);
    const currentUser = await this.dataService.getCurrentUser();
    
    // For explicit logins (user clicked login button), always run full sync
    if (isExplicitLogin) {
      console.log('🔑 Explicit login detected, performing full sync');
      this.loginPromise = this.performLogin(userId);
    }
    // For automatic/background logins (page refresh, token refresh)
    else if (currentUser === userId) {
      // Check if we have data in IndexedDB - if not, we need to sync
      const hasLocalData = await this.dataService.getOfflineCapabilities();
      
      // Also check if user profile exists in IndexedDB
      let userProfile = null;
      try {
        userProfile = await this.dataService.getUserProfile(userId);
        console.log('📋 User profile check:', userProfile ? 'found' : 'not found');
      } catch (error) {
        console.log('📋 User profile check error:', error);
      }
      
      if (hasLocalData.hasLocalData && userProfile) {
        console.log('🔄 Background auth for same user with local data and profile, skipping sync');
        return {
          success: true,
          synced_count: 0,
          failed_count: 0,
          conflicts: [],
          last_sync_timestamp: new Date().toISOString()
        };
      } else {
        console.log('🔄 Background auth for same user but missing data or profile, performing sync');
        this.loginPromise = this.performLogin(userId);
      }
    }
    // Different user or first time login
    else {
      console.log('🔑 Different user or first login, performing full sync');
      this.loginPromise = this.performLogin(userId);
    }
    
    try {
      const result = await this.loginPromise;
      return result;
    } finally {
      this.loginPromise = null;
    }
  }
  
  private async performLogin(userId: string): Promise<SyncResult> {
    console.log('🔑 Starting login process for user:', userId);
    await this.dataService.setCurrentUser(userId);
    
    if (navigator.onLine) {
      try {
        console.log('🌐 Online - performing full sync on login...');
        
        // First ensure user profile is initialized in the remote database
        await this.ensureUserProfileExists(userId);
        
        const result = await this.syncEngine.performFullSync(userId);
        console.log('✅ Login sync completed:', result);
        return result;
      } catch (error) {
        console.error('❌ Login sync failed:', error);
        return {
          success: false,
          synced_count: 0,
          failed_count: 1,
          conflicts: [],
          last_sync_timestamp: new Date().toISOString()
        };
      }
    } else {
      console.log('📱 Login in offline mode');
      return {
        success: true,
        synced_count: 0,
        failed_count: 0,
        conflicts: [],
        last_sync_timestamp: new Date().toISOString()
      };
    }
  }
  
  private async ensureUserProfileExists(userId: string): Promise<void> {
    try {
      // Import supabase to get current user info
      const { supabase } = await import('@/lib/supabase');
      
      // Get current user info from auth
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id !== userId) {
        console.warn('User ID mismatch during profile initialization');
        return;
      }
      
      // Import the database function to initialize user profile
      const { initializeUserProfile } = await import('@/lib/database');
      
      // This will create the profile if it doesn't exist, or return existing profile
      const profile = await initializeUserProfile(userId, user.email || '');
      console.log('✅ User profile initialized:', profile?.role);
    } catch (error) {
      console.error('Error ensuring user profile exists:', error);
      // Don't fail the login process if profile initialization fails
    }
  }

  async logout(): Promise<void> {
    if (navigator.onLine) {
      console.log('🔄 Syncing before logout...');
      await this.syncEngine.performQuickSync();
    }
    
    console.log('🔑 Clearing user data on logout...');
    await this.dataService.clearCurrentUser();
    
    // Clear all IndexedDB data to prevent data leakage between users
    await this.clearAllData();
    
    console.log('✅ Logged out successfully');
  }

  private async clearAllData(): Promise<void> {
    try {
      const stores = ['decks', 'cards', 'user_progress', 'user_profiles', 'deck_user_access'];
      for (const store of stores) {
        await this.dataService.clearStore(store as any);
      }
    } catch (error) {
      console.error('Error clearing data on logout:', error);
    }
  }

  async getDecks(): Promise<DeckWithStats[]> {
    try {
      const decks = await this.dataService.getDecks();
      
      if (navigator.onLine) {
        this.syncEngine.triggerSync();
      }
      
      return decks;
    } catch (error) {
      console.error('Error fetching decks:', error);
      throw error;
    }
  }

  async getDeck(deckId: string): Promise<DeckWithStats | undefined> {
    try {
      const deck = await this.dataService.getDeck(deckId);
      
      if (navigator.onLine) {
        this.syncEngine.triggerSync();
      }
      
      return deck;
    } catch (error) {
      console.error('Error fetching deck:', error);
      throw error;
    }
  }

  async getDeckCards(deckId: string): Promise<OfflineCard[]> {
    try {
      const cards = await this.dataService.getDeckCards(deckId);
      console.log(`Getting cards for deck ${deckId}:`, cards.length, 'cards found');
      return cards;
    } catch (error) {
      console.error('Error fetching deck cards:', error);
      throw error;
    }
  }

  async getStudySession(deckId: string): Promise<StudySession> {
    try {
      const session = await this.dataService.getStudySession(deckId);
      
      if (navigator.onLine) {
        this.syncEngine.triggerSync();
      }
      
      return session;
    } catch (error) {
      console.error('Error creating study session:', error);
      throw error;
    }
  }

  async getNewCards(deckId: string, limit: number = 20): Promise<OfflineCard[]> {
    try {
      return await this.dataService.getNewCards(deckId, limit);
    } catch (error) {
      console.error('Error fetching new cards:', error);
      throw error;
    }
  }

  async getReviewCards(deckId: string): Promise<OfflineCard[]> {
    try {
      return await this.dataService.getReviewCards(deckId);
    } catch (error) {
      console.error('Error fetching review cards:', error);
      throw error;
    }
  }

  async getDueCards(deckId?: string): Promise<CardType[]> {
    try {
      const offlineCards = await this.dataService.getDueCards(deckId);
      return await this.transformOfflineCardsToCards(offlineCards);
    } catch (error) {
      console.error('Error fetching due cards:', error);
      throw error;
    }
  }

  private async transformOfflineCardsToCards(offlineCards: OfflineCard[]): Promise<CardType[]> {
    const transformedCards = await Promise.all(
      offlineCards.map(offlineCard => this.transformOfflineCardToCard(offlineCard))
    );
    return transformedCards;
  }

  private async transformOfflineCardToCard(offlineCard: OfflineCard): Promise<CardType> {
    // Get user progress for this card if available
    const currentUser = await this.dataService.getCurrentUser();
    let userProgress: any = null;
    
    if (currentUser) {
      try {
        userProgress = await this.dataService.getUserProgress(currentUser, offlineCard.id);
      } catch (error) {
        console.log('No progress found for card:', offlineCard.id);
      }
    }
    
    return {
      id: offlineCard.id,
      front: offlineCard.front,
      back: {
        bangla: offlineCard.back_bangla,
        english: offlineCard.back_english
      },
      fsrsData: {
        due: userProgress ? new Date(userProgress.due) : new Date(),
        stability: userProgress?.stability || 2.5,
        difficulty: userProgress?.difficulty || 2.5,
        elapsed_days: userProgress?.elapsed_days || 0,
        scheduled_days: userProgress?.scheduled_days || 0,
        reps: userProgress?.reps || 0,
        lapses: userProgress?.lapses || 0,
        state: userProgress?.state || 0, // New card
        last_review: userProgress?.last_review ? new Date(userProgress.last_review) : undefined
      }
    };
  }

  async updateUserProgress(progress: OfflineUserProgress): Promise<OfflineUserProgress> {
    try {
      const updatedProgress = await this.dataService.updateUserProgress(progress);
      
      if (navigator.onLine) {
        this.syncEngine.triggerSync();
      }
      
      return updatedProgress;
    } catch (error) {
      console.error('Error updating user progress:', error);
      throw error;
    }
  }

  async batchUpdateUserProgress(progressList: OfflineUserProgress[]): Promise<OfflineUserProgress[]> {
    try {
      const updatedProgress = await this.dataService.batchUpdateUserProgress(progressList);
      
      if (navigator.onLine) {
        this.syncEngine.triggerSync();
      }
      
      return updatedProgress;
    } catch (error) {
      console.error('Error batch updating user progress:', error);
      throw error;
    }
  }

  async createDeck(deckData: {
    title: string;
    description?: string;
    author: string;
    daily_new_limit?: number;
    group_access_enabled?: boolean;
    is_public?: boolean;
  }): Promise<DeckWithStats> {
    try {
      const deck = await this.dataService.createDeck({
        title: deckData.title,
        description: deckData.description || '',
        author: deckData.author,
        daily_new_limit: deckData.daily_new_limit || 20,
        group_access_enabled: deckData.group_access_enabled || false,
        is_public: deckData.is_public || true
      });
      
      const deckWithStats = await this.dataService.getDeck(deck.id);
      if (!deckWithStats) {
        throw new Error('Failed to retrieve created deck');
      }
      
      if (navigator.onLine) {
        this.syncEngine.triggerSync();
      }
      
      return deckWithStats;
    } catch (error) {
      console.error('Error creating deck:', error);
      throw error;
    }
  }

  async createCard(cardData: {
    deck_id: string;
    front: string;
    back_bangla: string;
    back_english: string;
  }): Promise<OfflineCard> {
    try {
      const card = await this.dataService.createCard(cardData);
      
      if (navigator.onLine) {
        this.syncEngine.triggerSync();
      }
      
      return card;
    } catch (error) {
      console.error('Error creating card:', error);
      throw error;
    }
  }

  async updateCard(card: OfflineCard): Promise<OfflineCard> {
    try {
      const updatedCard = await this.dataService.updateCard(card);
      
      if (navigator.onLine) {
        this.syncEngine.triggerSync();
      }
      
      return updatedCard;
    } catch (error) {
      console.error('Error updating card:', error);
      throw error;
    }
  }

  async deleteCard(cardId: string): Promise<void> {
    try {
      await this.dataService.deleteCard(cardId);
      
      if (navigator.onLine) {
        this.syncEngine.triggerSync();
      }
    } catch (error) {
      console.error('Error deleting card:', error);
      throw error;
    }
  }

  async deleteDeck(deckId: string): Promise<void> {
    try {
      await this.dataService.deleteDeck(deckId);
      
      if (navigator.onLine) {
        this.syncEngine.triggerSync();
      }
    } catch (error) {
      console.error('Error deleting deck:', error);
      throw error;
    }
  }

  async hasUserAccess(userId: string, deckId: string): Promise<boolean> {
    try {
      return await this.dataService.hasUserAccess(userId, deckId);
    } catch (error) {
      console.error('Error checking user access:', error);
      return false;
    }
  }

  async getOfflineCapabilities(): Promise<OfflineCapabilities> {
    try {
      return await this.dataService.getOfflineCapabilities();
    } catch (error) {
      console.error('Error getting offline capabilities:', error);
      return {
        isOnline: navigator.onLine,
        hasLocalData: false,
        pendingSyncCount: 0
      };
    }
  }

  async getSyncStatus(): Promise<{
    isOnline: boolean;
    lastFullSync?: string;
    lastSuccessfulSync?: string;
    pendingChanges: number;
    failedChanges: number;
    isFullSyncRunning: boolean;
  }> {
    try {
      return await this.syncEngine.getSyncStatus();
    } catch (error) {
      console.error('Error getting sync status:', error);
      return {
        isOnline: navigator.onLine,
        pendingChanges: 0,
        failedChanges: 0,
        isFullSyncRunning: false
      };
    }
  }

  async retryFailedSync(): Promise<void> {
    try {
      await this.syncEngine.retryFailedSync();
    } catch (error) {
      console.error('Error retrying failed sync:', error);
      throw error;
    }
  }

  async exportData(): Promise<string> {
    try {
      const data = await this.dataService.exportData();
      return JSON.stringify(data, null, 2);
    } catch (error) {
      console.error('Error exporting data:', error);
      throw error;
    }
  }

  async importData(jsonData: string): Promise<void> {
    try {
      const data = JSON.parse(jsonData);
      await this.dataService.importData(data);
      
      if (navigator.onLine) {
        this.syncEngine.triggerSync();
      }
    } catch (error) {
      console.error('Error importing data:', error);
      throw error;
    }
  }



  isOnline(): boolean {
    return navigator.onLine;
  }

  onNetworkChange(callback: (isOnline: boolean) => void): () => void {
    const handleOnline = () => callback(true);
    const handleOffline = () => callback(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }
}

export const offlineService = OfflineService.getInstance();