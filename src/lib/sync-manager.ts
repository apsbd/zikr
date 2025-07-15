import { getDeckMetadata, getStudyCards, getUserProgress, saveCardProgress } from './database';
import type { DeckDisplayInfo, Card } from '@/types';

export interface LocalStorageData {
  decks: DeckDisplayInfo[];
  studyCards: Record<string, Card[]>; // deckId -> cards
  progress: Record<string, any>; // cardId -> progress
  pendingProgress: PendingProgress[];
  lastSync: string;
  nextSyncTime: string;
  userId: string;
  isInitialized: boolean;
}

export interface PendingProgress {
  cardId: string;
  fsrsData: any;
  timestamp: string;
}

class SyncManager {
  private readonly SYNC_INTERVAL = 30 * 60 * 1000; // 30 minutes
  private syncTimeout: NodeJS.Timeout | null = null;
  private isSyncing = false;
  private isInitialized = false;

  private getStorageKey(userId: string): string {
    return `app-data-${userId}`;
  }

  // Load all data from localStorage
  loadLocalData(userId: string): LocalStorageData | null {
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

  // Save all data to localStorage
  saveLocalData(userId: string, data: LocalStorageData): void {
    const key = this.getStorageKey(userId);
    localStorage.setItem(key, JSON.stringify(data));
  }

  // Check if sync is needed
  needsSync(userId: string): boolean {
    const data = this.loadLocalData(userId);
    if (!data || !data.isInitialized) return true;
    
    const now = new Date();
    const nextSync = new Date(data.nextSyncTime);
    return now >= nextSync;
  }

  // Get syncing state
  isSyncInProgress(): boolean {
    return this.isSyncing;
  }

  // Initialize - first time sync from database
  async initialize(userId: string): Promise<void> {
    if (this.isSyncing) return;
    
    const data = this.loadLocalData(userId);
    
    // If data exists and doesn't need sync, just schedule next sync
    if (data && data.isInitialized && !this.needsSync(userId)) {
      console.log('Data is up to date, scheduling next sync');
      this.scheduleNextSync(userId);
      return;
    }

    // Need to sync
    this.isSyncing = true;
    console.log('Starting sync process...');
    
    try {
      // Dispatch syncing event
      window.dispatchEvent(new CustomEvent('sync-started'));
      
      // First, sync any pending progress to database
      if (data?.pendingProgress) {
        await this.syncPendingProgress(userId, data.pendingProgress);
      }
      
      // Load all data from database
      const [decks, dbProgress] = await Promise.all([
        getDeckMetadata(userId),
        getUserProgress(userId),
      ]);
      
      console.log(`Loaded ${decks.length} decks for initial sync`);
      
      // Convert progress map to object
      const progressObj: Record<string, any> = {};
      dbProgress.forEach((prog, cardId) => {
        progressObj[cardId] = {
          state: prog.state,
          difficulty: prog.difficulty,
          stability: prog.stability,
          due: prog.due.toISOString(),
          elapsed_days: prog.elapsed_days,
          scheduled_days: prog.scheduled_days,
          reps: prog.reps,
          lapses: prog.lapses,
          last_review: prog.last_review?.toISOString(),
        };
      });
      
      // Load ALL cards for each deck (not just study cards)
      const studyCardsObj: Record<string, Card[]> = {};
      for (const deck of decks) {
        console.log(`Loading all cards for deck: ${deck.title} (${deck.id})`);
        // Use getDeckCards to get all cards, not just study cards
        const { getDeckCards } = await import('./database');
        const cards = await getDeckCards(deck.id, userId);
        studyCardsObj[deck.id] = cards;
        console.log(`Loaded ${cards.length} cards for deck: ${deck.title}`);
        
        // Update deck stats with correct total
        deck.stats.total = cards.length;
      }
      
      // Create new local data
      const now = new Date();
      const newData: LocalStorageData = {
        decks,
        studyCards: studyCardsObj,
        progress: progressObj,
        pendingProgress: [],
        lastSync: now.toISOString(),
        nextSyncTime: new Date(now.getTime() + this.SYNC_INTERVAL).toISOString(),
        userId,
        isInitialized: true,
      };
      
      // Save to localStorage
      this.saveLocalData(userId, newData);
      
      // Schedule next sync
      this.scheduleNextSync(userId);
      
      console.log('Sync completed successfully');
      
      // Mark as initialized
      this.isInitialized = true;
      
      // Dispatch sync complete event
      window.dispatchEvent(new CustomEvent('sync-completed'));
      
    } catch (error) {
      console.error('Sync failed:', error);
      
      // Dispatch sync error event
      window.dispatchEvent(new CustomEvent('sync-error', { detail: { error } }));
      
      // Retry in 5 minutes
      setTimeout(() => {
        this.initialize(userId);
      }, 5 * 60 * 1000);
    } finally {
      this.isSyncing = false;
    }
  }

  // Background sync
  private async backgroundSync(userId: string): Promise<void> {
    if (this.isSyncing) return;
    
    this.isSyncing = true;
    console.log('Background sync starting...');
    
    try {
      const data = this.loadLocalData(userId);
      if (!data) {
        // No local data, do full sync
        await this.initialize(userId);
        return;
      }
      
      // Sync pending progress to database
      if (data.pendingProgress.length > 0) {
        await this.syncPendingProgress(userId, data.pendingProgress);
        data.pendingProgress = [];
      }
      
      // Get fresh data from database
      const [decks, dbProgress] = await Promise.all([
        getDeckMetadata(userId),
        getUserProgress(userId),
      ]);
      
      // Update local data
      data.decks = decks;
      
      // Check if we need to refresh cards (new decks or missing cards)
      const { getDeckCards } = await import('./database');
      for (const deck of decks) {
        if (!data.studyCards[deck.id] || data.studyCards[deck.id].length === 0) {
          console.log(`Refreshing cards for deck: ${deck.title}`);
          const cards = await getDeckCards(deck.id, userId);
          data.studyCards[deck.id] = cards;
          deck.stats.total = cards.length;
        }
      }
      
      // Update progress (merge with local changes)
      const progressObj: Record<string, any> = {};
      dbProgress.forEach((prog, cardId) => {
        progressObj[cardId] = {
          state: prog.state,
          difficulty: prog.difficulty,
          stability: prog.stability,
          due: prog.due.toISOString(),
          elapsed_days: prog.elapsed_days,
          scheduled_days: prog.scheduled_days,
          reps: prog.reps,
          lapses: prog.lapses,
          last_review: prog.last_review?.toISOString(),
        };
      });
      
      data.progress = progressObj;
      
      // Update timestamps
      const now = new Date();
      data.lastSync = now.toISOString();
      data.nextSyncTime = new Date(now.getTime() + this.SYNC_INTERVAL).toISOString();
      
      // Save updated data
      this.saveLocalData(userId, data);
      
      // Schedule next sync
      this.scheduleNextSync(userId);
      
      console.log('Background sync completed');
      
      // Notify components
      window.dispatchEvent(new CustomEvent('data-updated'));
      
    } catch (error) {
      console.error('Background sync failed:', error);
      
      // Retry in 5 minutes
      setTimeout(() => {
        this.backgroundSync(userId);
      }, 5 * 60 * 1000);
    } finally {
      this.isSyncing = false;
    }
  }

  // Sync pending progress to database
  private async syncPendingProgress(userId: string, pending: PendingProgress[]): Promise<void> {
    if (pending.length === 0) return;
    
    console.log(`Syncing ${pending.length} pending progress items...`);
    
    const synced: string[] = [];
    
    for (const item of pending) {
      try {
        // Convert string dates back to Date objects
        const fsrsData = {
          ...item.fsrsData,
          due: new Date(item.fsrsData.due),
          last_review: item.fsrsData.last_review ? new Date(item.fsrsData.last_review) : undefined,
        };
        
        await saveCardProgress(item.cardId, fsrsData, userId);
        synced.push(item.cardId);
      } catch (error) {
        console.error(`Failed to sync progress for card ${item.cardId}:`, error);
      }
    }
    
    // Update local data to remove synced items
    const data = this.loadLocalData(userId);
    if (data) {
      data.pendingProgress = data.pendingProgress.filter(item => !synced.includes(item.cardId));
      this.saveLocalData(userId, data);
    }
    
    console.log(`Synced ${synced.length} progress items`);
  }

  // Schedule next sync
  private scheduleNextSync(userId: string): void {
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }
    
    const data = this.loadLocalData(userId);
    if (!data) return;
    
    const now = new Date();
    const nextSync = new Date(data.nextSyncTime);
    const timeToSync = nextSync.getTime() - now.getTime();
    
    if (timeToSync > 0) {
      this.syncTimeout = setTimeout(() => {
        this.backgroundSync(userId);
      }, timeToSync);
      
      console.log(`Next sync scheduled in ${Math.round(timeToSync / 1000 / 60)} minutes`);
    } else {
      // Sync immediately if overdue
      this.backgroundSync(userId);
    }
  }

  // Save card progress (offline-first)
  saveCardProgress(cardId: string, userId: string, fsrsData: any): void {
    console.log('syncManager.saveCardProgress called:', { cardId, userId, fsrsData });
    
    const data = this.loadLocalData(userId);
    if (!data) {
      console.log('No local data found for user:', userId);
      return;
    }
    
    // Update local progress immediately
    data.progress[cardId] = {
      state: fsrsData.state,
      difficulty: fsrsData.difficulty,
      stability: fsrsData.stability,
      due: fsrsData.due.toISOString(),
      elapsed_days: fsrsData.elapsed_days,
      scheduled_days: fsrsData.scheduled_days,
      reps: fsrsData.reps,
      lapses: fsrsData.lapses,
      last_review: fsrsData.last_review?.toISOString(),
    };
    
    // Add to pending progress
    const pendingItem: PendingProgress = {
      cardId,
      fsrsData: {
        ...fsrsData,
        due: fsrsData.due.toISOString(),
        last_review: fsrsData.last_review?.toISOString(),
      },
      timestamp: new Date().toISOString(),
    };
    
    // Remove existing pending progress for this card
    data.pendingProgress = data.pendingProgress.filter(p => p.cardId !== cardId);
    data.pendingProgress.push(pendingItem);
    
    // Save to localStorage
    this.saveLocalData(userId, data);
    console.log('Local data saved, dispatching progress-updated event');
    
    // Notify components
    window.dispatchEvent(new CustomEvent('progress-updated', { detail: { cardId, userId } }));
    console.log('progress-updated event dispatched for card:', cardId);
  }

  // Force sync now
  async forceSyncNow(userId: string): Promise<void> {
    await this.backgroundSync(userId);
  }

  // Force full re-sync (clears local data and re-downloads everything)
  async forceFullSync(userId: string): Promise<void> {
    console.log('Force full sync - clearing local data...');
    const key = this.getStorageKey(userId);
    localStorage.removeItem(key);
    this.isInitialized = false;
    await this.initialize(userId);
  }

  // Stop sync
  stopSync(): void {
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
      this.syncTimeout = null;
    }
  }

  // Get sync status
  getSyncStatus(userId: string): { nextSync: Date | null; lastSync: Date | null } {
    const data = this.loadLocalData(userId);
    if (!data) return { nextSync: null, lastSync: null };
    
    return {
      nextSync: new Date(data.nextSyncTime),
      lastSync: new Date(data.lastSync),
    };
  }
}

export const syncManager = new SyncManager();