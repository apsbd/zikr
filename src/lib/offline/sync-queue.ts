import { IndexedDBService } from './indexeddb-service';
import { STORE_NAMES, SyncQueueItem, OperationType } from './indexeddb-schema';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export class SyncQueueManager {
  private static instance: SyncQueueManager;
  private db: IndexedDBService;
  private supabase: typeof supabase = supabase;
  private isProcessing = false;
  private processingMutex = false;

  private constructor() {
    this.db = IndexedDBService.getInstance();
    // supabase client already initialized in constructor
  }

  static getInstance(): SyncQueueManager {
    if (!SyncQueueManager.instance) {
      SyncQueueManager.instance = new SyncQueueManager();
    }
    return SyncQueueManager.instance;
  }

  async queueOperation(
    operationType: OperationType,
    entityType: string,
    entityId: string,
    data: any
  ): Promise<void> {
    const queueItem: SyncQueueItem = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      operation_type: operationType,
      entity_type: entityType as any,
      entity_id: entityId,
      data,
      status: 'pending',
      retry_count: 0
    };

    await this.db.put(STORE_NAMES.SYNC_QUEUE, queueItem, true);
  }

  async processQueue(): Promise<void> {
    if (this.processingMutex) {
      return;
    }

    this.processingMutex = true;
    
    try {
      if (!navigator.onLine) {
        console.log('Device offline, skipping sync queue processing');
        return;
      }

      const pendingItems = await this.db.getSyncQueue();
      
      if (pendingItems.length === 0) {
        return;
      }

      console.log(`Processing ${pendingItems.length} sync queue items`);

      for (const item of pendingItems) {
        await this.processQueueItem(item);
      }

      await this.db.setMetadata('last_successful_sync', new Date().toISOString());
    } catch (error) {
      console.error('Error processing sync queue:', error);
    } finally {
      this.processingMutex = false;
    }
  }

  private async processQueueItem(item: SyncQueueItem): Promise<void> {
    try {
      item.status = 'processing';
      await this.db.updateSyncQueueItem(item);

      let result = false;

      switch (item.entity_type) {
        case STORE_NAMES.DECKS:
          result = await this.syncDeck(item);
          break;
        case STORE_NAMES.CARDS:
          result = await this.syncCard(item);
          break;
        case STORE_NAMES.USER_PROGRESS:
          result = await this.syncUserProgress(item);
          break;
        case STORE_NAMES.USER_PROFILES:
          result = await this.syncUserProfile(item);
          break;
        case STORE_NAMES.DECK_USER_ACCESS:
          result = await this.syncDeckUserAccess(item);
          break;
        default:
          console.warn(`Unknown entity type: ${item.entity_type}`);
          result = false;
      }

      if (result) {
        item.status = 'completed';
        await this.db.updateSyncQueueItem(item);
        
        await this.db.delete(STORE_NAMES.SYNC_QUEUE, item.id, true);
      } else {
        throw new Error(`Failed to sync ${item.entity_type} ${item.entity_id}`);
      }
    } catch (error) {
      console.error(`Error processing sync item ${item.id}:`, error);
      
      item.retry_count++;
      item.status = 'failed';
      item.last_error = error instanceof Error ? error.message : 'Unknown error';

      if (item.retry_count >= 3) {
        console.error(`Max retries exceeded for sync item ${item.id}`);
        await this.db.updateSyncQueueItem(item);
      } else {
        item.status = 'pending';
        await this.db.updateSyncQueueItem(item);
      }
    }
  }

  private async syncDeck(item: SyncQueueItem): Promise<boolean> {
    const { operation_type, entity_id, data } = item;

    try {
      switch (operation_type) {
        case OperationType.CREATE:
        case OperationType.UPDATE:
          const { data: result, error } = await this.supabase
            .from('decks')
            .upsert({
              id: entity_id,
              title: data.title,
              description: data.description,
              author: data.author,
              daily_new_limit: data.daily_new_limit,
              group_access_enabled: data.group_access_enabled,
              is_public: data.is_public,
              user_id: data.user_id,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'id'
            });

          if (error) throw error;
          return true;

        case OperationType.DELETE:
          const { error: deleteError } = await this.supabase
            .from('decks')
            .delete()
            .eq('id', entity_id);

          if (deleteError) throw deleteError;
          return true;

        default:
          return false;
      }
    } catch (error) {
      console.error(`Error syncing deck ${entity_id}:`, error);
      return false;
    }
  }

  private async syncCard(item: SyncQueueItem): Promise<boolean> {
    const { operation_type, entity_id, data } = item;

    try {
      switch (operation_type) {
        case OperationType.CREATE:
        case OperationType.UPDATE:
          const { data: result, error } = await this.supabase
            .from('cards')
            .upsert({
              id: entity_id,
              deck_id: data.deck_id,
              front: data.front,
              back_bangla: data.back_bangla,
              back_english: data.back_english,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'id'
            });

          if (error) throw error;
          return true;

        case OperationType.DELETE:
          const { error: deleteError } = await this.supabase
            .from('cards')
            .delete()
            .eq('id', entity_id);

          if (deleteError) throw deleteError;
          return true;

        default:
          return false;
      }
    } catch (error) {
      console.error(`Error syncing card ${entity_id}:`, error);
      return false;
    }
  }

  private async syncUserProgress(item: SyncQueueItem): Promise<boolean> {
    const { operation_type, entity_id, data } = item;

    try {
      switch (operation_type) {
        case OperationType.CREATE:
        case OperationType.UPDATE:
          const { data: result, error } = await this.supabase
            .from('user_progress')
            .upsert({
              id: entity_id,
              user_id: data.user_id,
              card_id: data.card_id,
              state: data.state,
              difficulty: data.difficulty,
              stability: data.stability,
              retrievability: data.retrievability,
              due: data.due,
              elapsed_days: data.elapsed_days,
              scheduled_days: data.scheduled_days,
              reps: data.reps,
              lapses: data.lapses,
              last_review: data.last_review,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'id'
            });

          if (error) throw error;
          return true;

        case OperationType.DELETE:
          const { error: deleteError } = await this.supabase
            .from('user_progress')
            .delete()
            .eq('id', entity_id);

          if (deleteError) throw deleteError;
          return true;

        default:
          return false;
      }
    } catch (error) {
      console.error(`Error syncing user progress ${entity_id}:`, error);
      return false;
    }
  }

  private async syncUserProfile(item: SyncQueueItem): Promise<boolean> {
    const { operation_type, entity_id, data } = item;

    try {
      switch (operation_type) {
        case OperationType.CREATE:
        case OperationType.UPDATE:
          const { data: result, error } = await this.supabase
            .from('user_profiles')
            .upsert({
              id: entity_id,
              user_id: data.user_id,
              email: data.email,
              role: data.role,
              is_banned: data.is_banned,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'id'
            });

          if (error) throw error;
          return true;

        case OperationType.DELETE:
          const { error: deleteError } = await this.supabase
            .from('user_profiles')
            .delete()
            .eq('id', entity_id);

          if (deleteError) throw deleteError;
          return true;

        default:
          return false;
      }
    } catch (error) {
      console.error(`Error syncing user profile ${entity_id}:`, error);
      return false;
    }
  }

  private async syncDeckUserAccess(item: SyncQueueItem): Promise<boolean> {
    const { operation_type, entity_id, data } = item;

    try {
      switch (operation_type) {
        case OperationType.CREATE:
        case OperationType.UPDATE:
          const { data: result, error } = await this.supabase
            .from('deck_user_access')
            .upsert({
              id: entity_id,
              deck_id: data.deck_id,
              user_id: data.user_id,
              granted_by: data.granted_by,
              granted_at: data.granted_at,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'id'
            });

          if (error) throw error;
          return true;

        case OperationType.DELETE:
          const { error: deleteError } = await this.supabase
            .from('deck_user_access')
            .delete()
            .eq('id', entity_id);

          if (deleteError) throw deleteError;
          return true;

        default:
          return false;
      }
    } catch (error) {
      console.error(`Error syncing deck user access ${entity_id}:`, error);
      return false;
    }
  }

  async schedulePeriodicSync(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    
    try {
      await this.processQueue();
      await this.db.setMetadata('next_scheduled_sync', 
        new Date(Date.now() + 5 * 60 * 1000).toISOString()
      );
    } catch (error) {
      console.error('Error in periodic sync:', error);
    } finally {
      this.isProcessing = false;
    }

    setTimeout(() => this.schedulePeriodicSync(), 5 * 60 * 1000);
  }

  async getQueueStatus(): Promise<{
    pending: number;
    processing: number;
    failed: number;
    completed: number;
  }> {
    const allItems = await this.db.getAll<SyncQueueItem>(STORE_NAMES.SYNC_QUEUE);
    
    return {
      pending: allItems.filter(item => item.status === 'pending').length,
      processing: allItems.filter(item => item.status === 'processing').length,
      failed: allItems.filter(item => item.status === 'failed').length,
      completed: allItems.filter(item => item.status === 'completed').length
    };
  }

  async retryFailedItems(): Promise<void> {
    const failedItems = await this.db.getByIndex<SyncQueueItem>(
      STORE_NAMES.SYNC_QUEUE,
      'status',
      'failed'
    );

    for (const item of failedItems) {
      if (item.retry_count < 3) {
        item.status = 'pending';
        item.retry_count = 0;
        await this.db.updateSyncQueueItem(item);
      }
    }
  }

  async clearCompletedItems(): Promise<void> {
    const completedItems = await this.db.getByIndex<SyncQueueItem>(
      STORE_NAMES.SYNC_QUEUE,
      'status',
      'completed'
    );

    for (const item of completedItems) {
      await this.db.delete(STORE_NAMES.SYNC_QUEUE, item.id, true);
    }
  }
}