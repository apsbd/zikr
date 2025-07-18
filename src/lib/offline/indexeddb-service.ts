import { 
  DB_NAME, 
  DB_VERSION, 
  DB_SCHEMA, 
  STORE_NAMES, 
  StoreName,
  SyncStatus,
  OperationType,
  SyncQueueItem
} from './indexeddb-schema';
import type {
  OfflineDeck,
  OfflineCard,
  OfflineUserProgress,
  OfflineUserProfile,
  OfflineDeckUserAccess,
  MetadataEntry,
  DeckWithStats
} from './types';

export class IndexedDBService {
  private static instance: IndexedDBService;
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  private constructor() {}

  static getInstance(): IndexedDBService {
    if (!IndexedDBService.instance) {
      IndexedDBService.instance = new IndexedDBService();
    }
    return IndexedDBService.instance;
  }

  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    console.log('Initializing IndexedDB...');
    this.initPromise = this.openDatabase();
    await this.initPromise;
  }

  private async openDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('IndexedDB opened successfully, version:', this.db.version);
        console.log('Available object stores:', Array.from(this.db.objectStoreNames));
        this.setupEventHandlers();
        resolve();
      };

      request.onupgradeneeded = (event) => {
        console.log('IndexedDB upgrade needed from version', event.oldVersion, 'to', event.newVersion);
        const db = (event.target as IDBOpenDBRequest).result;
        this.createObjectStores(db);
      };
    });
  }

  private createObjectStores(db: IDBDatabase): void {
    for (const [storeName, config] of Object.entries(DB_SCHEMA)) {
      if (!db.objectStoreNames.contains(storeName)) {
        console.log('Creating object store:', storeName);
        const store = db.createObjectStore(storeName, { keyPath: config.keyPath });
        
        for (const index of config.indexes) {
          store.createIndex(
            index.name,
            index.keyPath,
            { unique: index.unique || false }
          );
        }
      }
    }
  }

  private setupEventHandlers(): void {
    if (!this.db) return;

    this.db.onversionchange = () => {
      this.db?.close();
      this.db = null;
      window.location.reload();
    };

    this.db.onerror = (event) => {
      console.error('Database error:', event);
    };
  }

  private async ensureDb(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.init();
    }
    if (!this.db) {
      throw new Error('Failed to initialize database');
    }
    return this.db;
  }

  private async transaction(
    storeNames: StoreName | StoreName[],
    mode: IDBTransactionMode = 'readonly'
  ): Promise<IDBTransaction> {
    const db = await this.ensureDb();
    const stores = Array.isArray(storeNames) ? storeNames : [storeNames];
    return db.transaction(stores, mode);
  }

  async get<T>(storeName: StoreName, id: string): Promise<T | undefined> {
    const tx = await this.transaction(storeName);
    const store = tx.objectStore(storeName);
    
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAll<T>(storeName: StoreName): Promise<T[]> {
    const tx = await this.transaction(storeName);
    const store = tx.objectStore(storeName);
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async getByIndex<T>(
    storeName: StoreName,
    indexName: string,
    value: IDBValidKey | IDBKeyRange
  ): Promise<T[]> {
    const tx = await this.transaction(storeName);
    const store = tx.objectStore(storeName);
    const index = store.index(indexName);
    
    return new Promise((resolve, reject) => {
      const request = index.getAll(value);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async put<T extends { id: string }>(
    storeName: StoreName,
    data: T,
    skipSync = false
  ): Promise<T> {
    console.log(`IndexedDB PUT: ${storeName}`, data);
    
    const tx = await this.transaction([storeName, STORE_NAMES.SYNC_QUEUE], 'readwrite');
    const store = tx.objectStore(storeName);
    
    const entity = {
      ...data,
      sync_status: skipSync ? SyncStatus.SYNCED : SyncStatus.PENDING,
      local_changes: !skipSync,
      updated_at: new Date().toISOString()
    };

    return new Promise((resolve, reject) => {
      const request = store.put(entity);
      
      request.onsuccess = async () => {
        console.log(`Successfully stored in ${storeName}:`, entity.id);
        if (!skipSync) {
          await this.addToSyncQueue(tx, OperationType.UPDATE, storeName, data.id, entity);
        }
        resolve(entity);
      };
      
      request.onerror = () => {
        console.error(`Failed to put entity in ${storeName}:`, request.error);
        reject(request.error);
      };
    });
  }

  async putBatch<T extends { id: string }>(
    storeName: StoreName,
    items: T[],
    skipSync = false
  ): Promise<T[]> {
    const tx = await this.transaction([storeName, STORE_NAMES.SYNC_QUEUE], 'readwrite');
    const store = tx.objectStore(storeName);
    const results: T[] = [];

    for (const item of items) {
      const entity = {
        ...item,
        sync_status: skipSync ? SyncStatus.SYNCED : SyncStatus.PENDING,
        local_changes: !skipSync,
        updated_at: new Date().toISOString()
      };

      store.put(entity);
      results.push(entity);

      if (!skipSync) {
        await this.addToSyncQueue(tx, OperationType.UPDATE, storeName, item.id, entity);
      }
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(results);
      tx.onerror = () => reject(tx.error);
    });
  }

  async delete(storeName: StoreName, id: string, skipSync = false): Promise<void> {
    const tx = await this.transaction([storeName, STORE_NAMES.SYNC_QUEUE], 'readwrite');
    const store = tx.objectStore(storeName);

    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      
      request.onsuccess = async () => {
        if (!skipSync) {
          await this.addToSyncQueue(tx, OperationType.DELETE, storeName, id, { id });
        }
        resolve();
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  async clear(storeName: StoreName): Promise<void> {
    const tx = await this.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    
    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async addToSyncQueue(
    tx: IDBTransaction,
    operationType: OperationType,
    entityType: StoreName,
    entityId: string,
    data: any
  ): Promise<void> {
    const syncStore = tx.objectStore(STORE_NAMES.SYNC_QUEUE);
    
    const queueItem: SyncQueueItem = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      operation_type: operationType,
      entity_type: entityType,
      entity_id: entityId,
      data,
      status: 'pending',
      retry_count: 0
    };

    syncStore.put(queueItem);
  }

  async getSyncQueue(): Promise<SyncQueueItem[]> {
    const items = await this.getByIndex<SyncQueueItem>(
      STORE_NAMES.SYNC_QUEUE,
      'status',
      'pending'
    );
    
    return items.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }

  async updateSyncQueueItem(item: SyncQueueItem): Promise<void> {
    const tx = await this.transaction(STORE_NAMES.SYNC_QUEUE, 'readwrite');
    const store = tx.objectStore(STORE_NAMES.SYNC_QUEUE);
    
    return new Promise((resolve, reject) => {
      const request = store.put(item);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getMetadata(key: string): Promise<any> {
    const entry = await this.get<MetadataEntry>(STORE_NAMES.METADATA, key);
    return entry?.value;
  }

  async setMetadata(key: string, value: any): Promise<void> {
    const entry: MetadataEntry = {
      key,
      value,
      updated_at: new Date().toISOString()
    };
    
    // Use direct transaction for metadata since it has key as keyPath
    const tx = await this.transaction(STORE_NAMES.METADATA, 'readwrite');
    const store = tx.objectStore(STORE_NAMES.METADATA);
    
    return new Promise((resolve, reject) => {
      const request = store.put(entry);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getDeckWithStats(deckId: string, userId: string): Promise<DeckWithStats | undefined> {
    const deck = await this.get<OfflineDeck>(STORE_NAMES.DECKS, deckId);
    if (!deck) return undefined;

    const cards = await this.getByIndex<OfflineCard>(
      STORE_NAMES.CARDS,
      'deck_id',
      deckId
    );

    console.log(`Getting stats for deck ${deckId}: found ${cards.length} cards`);

    const userProgress = await this.getByIndex<OfflineUserProgress>(
      STORE_NAMES.USER_PROGRESS,
      'user_id',
      userId
    );

    const cardProgressMap = new Map(
      userProgress.map(p => [p.card_id, p])
    );

    let newCount = 0;
    let learningCount = 0;
    let reviewCount = 0;
    let dueCount = 0;
    let nextReviewTime: string | undefined;

    const now = new Date().toISOString();
    const allDueTimes: string[] = [];
    
    for (const card of cards) {
      const progress = cardProgressMap.get(card.id);
      if (!progress) {
        newCount++;
        // New cards are considered due (up to daily limit)
        if (newCount <= (deck.daily_new_limit || 20)) {
          dueCount++;
        }
      } else {
        switch (progress.state) {
          case 0: newCount++; break;
          case 1: 
          case 3: learningCount++; break;
          case 2: reviewCount++; break;
        }
        
        // Check if card is due for study
        if (progress.due <= now) {
          dueCount++;
        }
        
        // Collect all due times for next review calculation
        allDueTimes.push(progress.due);
      }
    }

    // Find the earliest future due time (cards that are not due yet)
    const futureDueTimes = allDueTimes.filter(time => time > now);
    if (futureDueTimes.length > 0) {
      futureDueTimes.sort();
      nextReviewTime = futureDueTimes[0];
    }

    console.log(`📊 getDeckWithStats for ${deck.title}: ${dueCount} due cards from ${cards.length} total`);

    return {
      ...deck,
      card_count: cards.length,
      new_count: newCount,
      learning_count: learningCount,
      review_count: reviewCount,
      due_count: dueCount,
      next_review_time: nextReviewTime,
      total_studied: userProgress.filter(p => p.reps > 0).length
    };
  }

  async getUserDecks(userId: string): Promise<DeckWithStats[]> {
    const [allDecks, userAccess, userProfileArray] = await Promise.all([
      this.getAll<OfflineDeck>(STORE_NAMES.DECKS),
      this.getByIndex<OfflineDeckUserAccess>(STORE_NAMES.DECK_USER_ACCESS, 'user_id', userId),
      this.getByIndex<OfflineUserProfile>(STORE_NAMES.USER_PROFILES, 'user_id', userId)
    ]);

    // Extract the first profile from the array (should be unique)
    const userProfile = userProfileArray[0];

    console.log('🔍 getUserDecks debug:', {
      userId,
      allDecks: allDecks.length,
      userAccess: userAccess.length,
      userProfile: userProfile?.role,
      isAdmin: userProfile?.role === 'admin' || userProfile?.role === 'superuser'
    });

    const accessibleDeckIds = new Set(userAccess.map(a => a.deck_id));
    const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'superuser';

    const accessibleDecks = allDecks.filter(deck => 
      deck.is_public || 
      deck.user_id === userId || 
      (deck.group_access_enabled && accessibleDeckIds.has(deck.id)) ||
      isAdmin
    );

    console.log('🔍 Accessible decks after filter:', accessibleDecks.length);

    const decksWithStats = await Promise.all(
      accessibleDecks.map(deck => this.getDeckWithStats(deck.id, userId))
    );

    return decksWithStats.filter((deck): deck is DeckWithStats => deck !== undefined);
  }

  async getDueCards(userId: string, deckId?: string): Promise<OfflineCard[]> {
    const now = new Date().toISOString();
    
    // Get all cards for the deck
    const allCards = deckId 
      ? await this.getByIndex<OfflineCard>(STORE_NAMES.CARDS, 'deck_id', deckId)
      : await this.getAll<OfflineCard>(STORE_NAMES.CARDS);

    console.log(`🎴 getDueCards: Found ${allCards.length} total cards for deck ${deckId || 'all'}`);

    // Get all user progress for these cards
    const userProgress = await this.getByIndex<OfflineUserProgress>(
      STORE_NAMES.USER_PROGRESS,
      'user_id',
      userId
    );

    // Create a map of card progress
    const progressMap = new Map(userProgress.map(p => [p.card_id, p]));

    // Get deck to check daily limits
    const deck = deckId ? await this.get<OfflineDeck>(STORE_NAMES.DECKS, deckId) : null;
    const dailyNewLimit = deck?.daily_new_limit || 20;

    let newCardsIncluded = 0;
    let dueReviewCards = 0;
    
    // Filter cards that are due
    const dueCards = allCards.filter(card => {
      const progress = progressMap.get(card.id);
      
      if (!progress) {
        // New card - include up to daily limit
        if (newCardsIncluded < dailyNewLimit) {
          newCardsIncluded++;
          return true;
        }
        return false;
      }
      
      // Card with progress - check if due
      if (progress.due <= now) {
        dueReviewCards++;
        return true;
      }
      return false;
    });

    console.log(`🎴 getDueCards result: ${dueCards.length} due cards (${newCardsIncluded} new, ${dueReviewCards} reviews)`);
    
    return dueCards;
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}