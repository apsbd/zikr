import { IndexedDBService } from './indexeddb-service';
import { SyncQueueManager } from './sync-queue';
import { STORE_NAMES, SyncStatus } from './indexeddb-schema';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import type { 
  OfflineDeck, 
  OfflineCard, 
  OfflineUserProgress, 
  OfflineUserProfile, 
  OfflineDeckUserAccess,
  ConflictResolution,
  SyncResult
} from './types';

export class SyncEngine {
  private static instance: SyncEngine;
  private db: IndexedDBService;
  private syncQueue: SyncQueueManager;
  private supabase: typeof supabase = supabase;
  private isFullSyncRunning = false;
  private syncWorker: Worker | null = null;

  private constructor() {
    this.db = IndexedDBService.getInstance();
    this.syncQueue = SyncQueueManager.getInstance();
    // supabase client already initialized in constructor
  }

  static getInstance(): SyncEngine {
    if (!SyncEngine.instance) {
      SyncEngine.instance = new SyncEngine();
    }
    return SyncEngine.instance;
  }

  async init(): Promise<void> {
    await this.db.init();
    
    if (typeof Worker !== 'undefined' && 'serviceWorker' in navigator) {
      this.setupServiceWorkerListener();
    }
    
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('Network online - starting sync');
        this.triggerSync();
      });

      window.addEventListener('offline', () => {
        console.log('Network offline - sync paused');
      });

      window.addEventListener('beforeunload', () => {
        this.performQuickSync();
      });
    }
  }

  private async setupServiceWorkerListener(): Promise<void> {
    // Don't register SW here - app-updater handles SW registration
    // Just set up listener for messages from the service worker
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'SYNC_REQUIRED') {
        this.triggerSync();
      }
    });
  }

  async performFullSync(userId: string): Promise<SyncResult> {
    if (this.isFullSyncRunning) {
      console.log('⚠️ Full sync already in progress, skipping...');
      return {
        success: false,
        synced_count: 0,
        failed_count: 0,
        conflicts: [],
        last_sync_timestamp: new Date().toISOString()
      };
    }

    this.isFullSyncRunning = true;
    const startTime = Date.now();
    let syncedCount = 0;
    let failedCount = 0;
    const conflicts: ConflictResolution[] = [];

    try {
      console.log('🔄 Starting full sync for user:', userId);
      
      console.log('📋 Processing sync queue...');
      await this.syncQueue.processQueue();
      
      const [
        remoteDecks,
        remoteCards, 
        remoteProgress,
        remoteProfiles,
        remoteAccess
      ] = await Promise.all([
        this.fetchRemoteDecks(userId),
        this.fetchRemoteCards(userId),
        this.fetchRemoteUserProgress(userId),
        this.fetchRemoteUserProfiles(userId),
        this.fetchRemoteDeckUserAccess(userId)
      ]);


      const syncResults = await Promise.allSettled([
        this.syncEntity(STORE_NAMES.DECKS, remoteDecks),
        this.syncEntity(STORE_NAMES.CARDS, remoteCards),
        this.syncEntity(STORE_NAMES.USER_PROGRESS, remoteProgress),
        this.syncEntity(STORE_NAMES.USER_PROFILES, remoteProfiles),
        this.syncEntity(STORE_NAMES.DECK_USER_ACCESS, remoteAccess)
      ]);

      for (const result of syncResults) {
        if (result.status === 'fulfilled') {
          syncedCount += result.value.syncedCount;
          failedCount += result.value.failedCount;
          conflicts.push(...result.value.conflicts);
        } else {
          console.error('Sync failed:', result.reason);
          failedCount++;
        }
      }

      await this.db.setMetadata('last_full_sync', new Date().toISOString());
      
      return {
        success: failedCount === 0,
        synced_count: syncedCount,
        failed_count: failedCount,
        conflicts,
        last_sync_timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Full sync failed:', error);
      throw error;
    } finally {
      this.isFullSyncRunning = false;
      console.log(`Full sync completed in ${Date.now() - startTime}ms`);
    }
  }

  private async fetchRemoteDecks(userId: string): Promise<OfflineDeck[]> {
    try {
      // First check if user is admin or superuser
      const { data: userProfile, error: profileError } = await this.supabase
        .from('user_profiles')
        .select('role')
        .eq('user_id', userId)
        .single();

      const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'superuser';
      console.log(`User ${userId} admin status:`, isAdmin);

      if (isAdmin) {
        // Admin/superuser gets ALL decks
        const { data: allDecks, error: allDecksError } = await this.supabase
          .from('decks')
          .select('*');

        if (allDecksError) {
          console.error('Error fetching all decks for admin:', allDecksError);
          return [];
        }

        console.log(`Admin fetched ${allDecks?.length || 0} decks (all decks)`);
        return allDecks || [];
      }

      // Regular user: get public decks and user-specific decks
      const { data: publicDecks, error: publicError } = await this.supabase
        .from('decks')
        .select('*')
        .eq('is_public', true);

      if (publicError) {
        console.error('Error fetching public decks:', publicError);
        return [];
      }

      // Then try to get user-specific decks through deck_user_access
      const { data: userAccessDecks, error: userAccessError } = await this.supabase
        .from('deck_user_access')
        .select(`
          deck_id,
          decks (*)
        `)
        .eq('user_id', userId);

      let userDecks: any[] = [];
      if (!userAccessError && userAccessDecks) {
        userDecks = userAccessDecks
          .map(access => access.decks)
          .filter(deck => deck != null);
      }

      // Combine and deduplicate
      const allDecks = [...(publicDecks || []), ...userDecks];
      const uniqueDecks = allDecks.filter((deck, index, self) => 
        index === self.findIndex(d => d.id === deck.id)
      );

      console.log(`Regular user fetched ${uniqueDecks.length} decks (public + user-specific)`);
      return uniqueDecks;
    } catch (error) {
      console.error('Failed to fetch decks:', error);
      return [];
    }
  }

  private async fetchRemoteCards(userId: string): Promise<OfflineCard[]> {
    try {
      // Get all accessible deck IDs first
      const accessibleDecks = await this.fetchRemoteDecks(userId);
      const deckIds = accessibleDecks.map(deck => deck.id);
      
      console.log('Accessible decks for cards:', deckIds);
      
      if (deckIds.length === 0) {
        console.log('No accessible decks found, skipping card fetch');
        return [];
      }

      // Fetch all cards from accessible decks
      const { data: cards, error } = await this.supabase
        .from('cards')
        .select('*')
        .in('deck_id', deckIds);

      if (error) {
        console.error('Error fetching cards:', error);
        return [];
      }

      console.log(`Fetched ${cards?.length || 0} cards from ${deckIds.length} accessible decks`);
      
      if (cards && cards.length > 0) {
        console.log('Sample cards:', cards.slice(0, 3));
        const cardsByDeck = cards.reduce((acc, card) => {
          acc[card.deck_id] = (acc[card.deck_id] || 0) + 1;
          return acc;
        }, {});
        console.log('Cards by deck:', cardsByDeck);
      }

      return (cards || []).map(card => ({
        id: card.id,
        deck_id: card.deck_id,
        front: card.front,
        back_bangla: card.back_bangla,
        back_english: card.back_english,
        created_at: card.created_at,
        updated_at: card.updated_at
      }));
    } catch (error) {
      console.error('Failed to fetch cards:', error);
      return [];
    }
  }

  private async fetchRemoteUserProgress(userId: string): Promise<OfflineUserProgress[]> {
    const { data, error } = await this.supabase
      .from('user_progress')
      .select('*')
      .eq('user_id', userId);

    if (error) throw error;
    return data || [];
  }

  private async fetchRemoteUserProfiles(userId: string): Promise<OfflineUserProfile[]> {
    try {
      console.log('👤 Fetching user profiles for:', userId);
      
      // First check if user is admin or superuser
      const { data: userProfile, error: profileError } = await this.supabase
        .from('user_profiles')
        .select('role')
        .eq('user_id', userId)
        .single();

      console.log('👤 User profile check result:', { userProfile, profileError });
      const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'superuser';

      if (isAdmin) {
        // Admin/superuser gets ALL user profiles (needed for access control)
        const { data, error } = await this.supabase
          .from('user_profiles')
          .select('*');

        if (error) {
          console.error('Error fetching all user profiles for admin:', error);
          return [];
        }
        
        console.log(`👤 Admin fetched ${data?.length || 0} user profiles (all profiles):`, data);
        return data || [];
      }

      // Regular user: get only their own profile
      const { data, error } = await this.supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId);

      if (error) {
        console.error('👤 Error fetching user profiles:', error);
        return [];
      }
      
      console.log(`👤 Regular user fetched ${data?.length || 0} user profiles:`, data);
      return data || [];
    } catch (error) {
      console.error('Failed to fetch user profiles:', error);
      return [];
    }
  }

  private async fetchRemoteDeckUserAccess(userId: string): Promise<OfflineDeckUserAccess[]> {
    try {
      // First check if user is admin or superuser
      const { data: userProfile, error: profileError } = await this.supabase
        .from('user_profiles')
        .select('role')
        .eq('user_id', userId)
        .single();

      const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'superuser';

      if (isAdmin) {
        // Admin/superuser gets ALL deck user access records
        const { data, error } = await this.supabase
          .from('deck_user_access')
          .select('*');

        if (error) {
          console.error('Error fetching all deck user access for admin:', error);
          return [];
        }
        
        console.log(`Admin fetched ${data?.length || 0} deck user access records (all records)`);
        return data || [];
      }

      // Regular user: get only their own access records
      const { data, error } = await this.supabase
        .from('deck_user_access')
        .select('*')
        .eq('user_id', userId);

      if (error) {
        console.error('Error fetching deck user access:', error);
        // Return empty array if table doesn't exist or access denied
        return [];
      }
      
      console.log(`Regular user fetched ${data?.length || 0} deck user access records (own records)`);
      return data || [];
    } catch (error) {
      console.error('Failed to fetch deck user access:', error);
      return [];
    }
  }

  private async syncEntity<T extends { id: string; updated_at: string }>(
    storeName: string,
    remoteEntities: T[]
  ): Promise<{
    syncedCount: number;
    failedCount: number;
    conflicts: ConflictResolution[];
  }> {
    console.log(`🔄 Syncing ${storeName}: ${remoteEntities.length} remote entities`);
    
    if (storeName === 'user_profiles') {
      console.log('👤 User profiles to sync:', remoteEntities);
    }
    
    const localEntities = await this.db.getAll<T>(storeName as any);
    const localEntityMap = new Map(localEntities.map(e => [e.id, e]));
    
    let syncedCount = 0;
    let failedCount = 0;
    const conflicts: ConflictResolution[] = [];

    for (const remoteEntity of remoteEntities) {
      try {
        const localEntity = localEntityMap.get(remoteEntity.id);
        
        if (storeName === 'user_profiles') {
          console.log(`👤 Processing profile ${remoteEntity.id}:`, {
            hasLocal: !!localEntity,
            localEntity: localEntity,
            remoteEntity: remoteEntity
          });
        }
        
        if (!localEntity) {
          await this.db.put(storeName as any, {
            ...remoteEntity,
            sync_status: SyncStatus.SYNCED,
            last_synced: new Date().toISOString()
          }, true);
          syncedCount++;
          
          if (storeName === 'user_profiles') {
            console.log(`👤 Created new profile ${remoteEntity.id}`);
          }
        } else if (this.needsSync(localEntity, remoteEntity)) {
          const resolution = await this.resolveConflict(localEntity, remoteEntity);
          conflicts.push(resolution);
          
          if (resolution.resolved_data) {
            await this.db.put(storeName as any, {
              ...resolution.resolved_data,
              sync_status: SyncStatus.SYNCED,
              last_synced: new Date().toISOString()
            }, true);
            syncedCount++;
          }
        } else {
          // Entity exists locally and doesn't need syncing
          if (storeName === 'user_profiles') {
            console.log(`👤 Profile ${remoteEntity.id} already exists and is up to date`);
          }
        }
        
        localEntityMap.delete(remoteEntity.id);
      } catch (error) {
        console.error(`Error syncing ${storeName} entity ${remoteEntity.id}:`, error);
        failedCount++;
      }
    }

    const deletedEntities = Array.from(localEntityMap.values())
      .filter(e => (e as any).sync_status === SyncStatus.SYNCED);
    
    for (const deletedEntity of deletedEntities) {
      await this.db.delete(storeName as any, deletedEntity.id, true);
      syncedCount++;
    }

    console.log(`${storeName} sync complete: ${syncedCount} synced, ${failedCount} failed`);
    return { syncedCount, failedCount, conflicts };
  }

  private needsSync<T extends { updated_at: string }>(
    localEntity: T & { sync_status?: SyncStatus; local_changes?: boolean },
    remoteEntity: T
  ): boolean {
    if (localEntity.local_changes && localEntity.sync_status === SyncStatus.PENDING) {
      return true;
    }

    const localTimestamp = new Date(localEntity.updated_at).getTime();
    const remoteTimestamp = new Date(remoteEntity.updated_at).getTime();
    
    const needsSync = remoteTimestamp > localTimestamp;
    
    // Debug logging for user profiles
    if ('user_id' in localEntity && 'role' in localEntity) {
      console.log(`👤 needsSync check for profile ${(localEntity as any).user_id}:`, {
        local: localEntity,
        remote: remoteEntity,
        localTimestamp: new Date(localEntity.updated_at).toISOString(),
        remoteTimestamp: new Date(remoteEntity.updated_at).toISOString(),
        needsSync: needsSync
      });
    }
    
    return needsSync;
  }

  private async resolveConflict<T extends { id: string; updated_at: string }>(
    localEntity: T & { sync_status?: SyncStatus; local_changes?: boolean },
    remoteEntity: T
  ): Promise<ConflictResolution> {
    const localTimestamp = new Date(localEntity.updated_at).getTime();
    const remoteTimestamp = new Date(remoteEntity.updated_at).getTime();
    
    if (localEntity.local_changes && localEntity.sync_status === SyncStatus.PENDING) {
      if (remoteTimestamp > localTimestamp) {
        return {
          strategy: 'remote_wins',
          local_data: localEntity,
          remote_data: remoteEntity,
          resolved_data: remoteEntity,
          resolved_at: new Date().toISOString()
        };
      } else {
        return {
          strategy: 'local_wins',
          local_data: localEntity,
          remote_data: remoteEntity,
          resolved_data: localEntity,
          resolved_at: new Date().toISOString()
        };
      }
    }

    if (remoteTimestamp > localTimestamp) {
      return {
        strategy: 'remote_wins',
        local_data: localEntity,
        remote_data: remoteEntity,
        resolved_data: remoteEntity,
        resolved_at: new Date().toISOString()
      };
    } else {
      return {
        strategy: 'local_wins',
        local_data: localEntity,
        remote_data: remoteEntity,
        resolved_data: localEntity,
        resolved_at: new Date().toISOString()
      };
    }
  }

  async triggerSync(): Promise<void> {
    if (!navigator.onLine) {
      console.log('Device offline, sync will be performed when online');
      return;
    }

    try {
      await this.syncQueue.processQueue();
    } catch (error) {
      console.error('Sync queue processing failed:', error);
    }
  }

  async performQuickSync(): Promise<void> {
    if (!navigator.onLine) return;

    try {
      const pendingCount = (await this.syncQueue.getQueueStatus()).pending;
      if (pendingCount > 0) {
        console.log(`Quick sync: ${pendingCount} pending items`);
        await this.syncQueue.processQueue();
      }
    } catch (error) {
      console.error('Quick sync failed:', error);
    }
  }

  async scheduleBackgroundSync(): Promise<void> {
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
      try {
        const registration = await navigator.serviceWorker.ready;
        // Type assertion for background sync since it's experimental
        const syncRegistration = registration as any;
        if (syncRegistration.sync) {
          await syncRegistration.sync.register('background-sync');
          console.log('Background sync registered');
        } else {
          this.fallbackPeriodicSync();
        }
      } catch (error) {
        console.error('Background sync registration failed:', error);
        this.fallbackPeriodicSync();
      }
    } else {
      console.log('Background sync not supported, using fallback');
      this.fallbackPeriodicSync();
    }
  }

  private fallbackPeriodicSync(): void {
    setInterval(() => {
      this.triggerSync();
    }, 5 * 60 * 1000);
  }

  async getSyncStatus(): Promise<{
    isOnline: boolean;
    lastFullSync?: string;
    lastSuccessfulSync?: string;
    pendingChanges: number;
    failedChanges: number;
    isFullSyncRunning: boolean;
  }> {
    const [lastFullSync, lastSuccessfulSync, queueStatus] = await Promise.all([
      this.db.getMetadata('last_full_sync'),
      this.db.getMetadata('last_successful_sync'),
      this.syncQueue.getQueueStatus()
    ]);

    return {
      isOnline: navigator.onLine,
      lastFullSync,
      lastSuccessfulSync,
      pendingChanges: queueStatus.pending,
      failedChanges: queueStatus.failed,
      isFullSyncRunning: this.isFullSyncRunning
    };
  }

  async retryFailedSync(): Promise<void> {
    await this.syncQueue.retryFailedItems();
    await this.triggerSync();
  }

  async clearSyncData(): Promise<void> {
    await this.db.clear(STORE_NAMES.SYNC_QUEUE);
    await this.db.setMetadata('last_full_sync', null);
    await this.db.setMetadata('last_successful_sync', null);
  }
}