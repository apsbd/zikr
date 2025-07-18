export const DB_NAME = 'zikr-app-offline';
export const DB_VERSION = 1;

export interface IndexConfig {
  name: string;
  keyPath: string | string[];
  unique?: boolean;
}

export interface StoreConfig {
  keyPath: string;
  indexes: IndexConfig[];
}

export const STORE_NAMES = {
  DECKS: 'decks',
  CARDS: 'cards',
  USER_PROGRESS: 'user_progress',
  USER_PROFILES: 'user_profiles',
  DECK_USER_ACCESS: 'deck_user_access',
  SYNC_QUEUE: 'sync_queue',
  METADATA: 'metadata'
} as const;

export type StoreName = typeof STORE_NAMES[keyof typeof STORE_NAMES];

export const DB_SCHEMA: Record<StoreName, StoreConfig> = {
  [STORE_NAMES.DECKS]: {
    keyPath: 'id',
    indexes: [
      { name: 'created_at', keyPath: 'created_at' },
      { name: 'is_public', keyPath: 'is_public' },
      { name: 'group_access_enabled', keyPath: 'group_access_enabled' },
      { name: 'user_id', keyPath: 'user_id' },
      { name: 'sync_status', keyPath: 'sync_status' },
      { name: 'last_synced', keyPath: 'last_synced' }
    ]
  },
  
  [STORE_NAMES.CARDS]: {
    keyPath: 'id',
    indexes: [
      { name: 'deck_id', keyPath: 'deck_id' },
      { name: 'created_at', keyPath: 'created_at' },
      { name: 'deck_id_created_at', keyPath: ['deck_id', 'created_at'] },
      { name: 'sync_status', keyPath: 'sync_status' },
      { name: 'last_synced', keyPath: 'last_synced' }
    ]
  },
  
  [STORE_NAMES.USER_PROGRESS]: {
    keyPath: 'id',
    indexes: [
      { name: 'user_id', keyPath: 'user_id' },
      { name: 'card_id', keyPath: 'card_id' },
      { name: 'user_card', keyPath: ['user_id', 'card_id'], unique: true },
      { name: 'due', keyPath: 'due' },
      { name: 'user_due', keyPath: ['user_id', 'due'] },
      { name: 'state', keyPath: 'state' },
      { name: 'user_state', keyPath: ['user_id', 'state'] },
      { name: 'sync_status', keyPath: 'sync_status' },
      { name: 'last_synced', keyPath: 'last_synced' }
    ]
  },
  
  [STORE_NAMES.USER_PROFILES]: {
    keyPath: 'id',
    indexes: [
      { name: 'user_id', keyPath: 'user_id', unique: true },
      { name: 'email', keyPath: 'email', unique: true },
      { name: 'role', keyPath: 'role' },
      { name: 'sync_status', keyPath: 'sync_status' },
      { name: 'last_synced', keyPath: 'last_synced' }
    ]
  },
  
  [STORE_NAMES.DECK_USER_ACCESS]: {
    keyPath: 'id',
    indexes: [
      { name: 'deck_id', keyPath: 'deck_id' },
      { name: 'user_id', keyPath: 'user_id' },
      { name: 'deck_user', keyPath: ['deck_id', 'user_id'], unique: true },
      { name: 'granted_by', keyPath: 'granted_by' },
      { name: 'sync_status', keyPath: 'sync_status' },
      { name: 'last_synced', keyPath: 'last_synced' }
    ]
  },
  
  [STORE_NAMES.SYNC_QUEUE]: {
    keyPath: 'id',
    indexes: [
      { name: 'timestamp', keyPath: 'timestamp' },
      { name: 'operation_type', keyPath: 'operation_type' },
      { name: 'entity_type', keyPath: 'entity_type' },
      { name: 'entity_id', keyPath: 'entity_id' },
      { name: 'status', keyPath: 'status' },
      { name: 'retry_count', keyPath: 'retry_count' }
    ]
  },
  
  [STORE_NAMES.METADATA]: {
    keyPath: 'key',
    indexes: [
      { name: 'updated_at', keyPath: 'updated_at' }
    ]
  }
};

export enum SyncStatus {
  SYNCED = 'synced',
  PENDING = 'pending',
  ERROR = 'error'
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete'
}

export interface SyncQueueItem {
  id: string;
  timestamp: string;
  operation_type: OperationType;
  entity_type: StoreName;
  entity_id: string;
  data: any;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  retry_count: number;
  last_error?: string;
}

export interface OfflineEntity {
  sync_status?: SyncStatus;
  last_synced?: string;
  local_changes?: boolean;
  conflict_resolution_data?: any;
}