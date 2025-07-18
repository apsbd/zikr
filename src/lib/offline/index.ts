export { OfflineService, offlineService } from './offline-service';
export { OfflineDataService } from './offline-data-service';
export { SyncEngine } from './sync-engine';
export { SyncQueueManager } from './sync-queue';
export { IndexedDBService } from './indexeddb-service';

export * from './types';
export * from './indexeddb-schema';

export {
  DB_NAME,
  DB_VERSION,
  STORE_NAMES,
  SyncStatus,
  OperationType
} from './indexeddb-schema';

export type { 
  SyncQueueItem,
  StoreName,
  IndexConfig,
  StoreConfig 
} from './indexeddb-schema';

// Import debug helper in development
if (process.env.NODE_ENV === 'development') {
  import('./debug-helper');
}