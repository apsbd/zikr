import { SyncStatus } from './indexeddb-schema';

export interface OfflineMetadata {
  sync_status?: SyncStatus;
  last_synced?: string;
  local_changes?: boolean;
  conflict_resolution_data?: any;
}

export interface OfflineDeck extends OfflineMetadata {
  id: string;
  title: string;
  description?: string;
  author: string;
  daily_new_limit: number;
  group_access_enabled: boolean;
  is_public: boolean;
  user_id?: string;
  created_at: string;
  updated_at: string;
}

export interface OfflineCard extends OfflineMetadata {
  id: string;
  deck_id: string;
  front: string;
  back_bangla: string;
  back_english: string;
  created_at: string;
  updated_at: string;
}

export interface OfflineUserProgress extends OfflineMetadata {
  id: string;
  user_id: string;
  card_id: string;
  state: number;
  difficulty: number;
  stability: number;
  retrievability: number;
  due: string;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  last_review?: string;
  created_at: string;
  updated_at: string;
}

export interface OfflineUserProfile extends OfflineMetadata {
  id: string;
  user_id: string;
  email: string;
  role: 'user' | 'admin' | 'superuser';
  is_banned: boolean;
  created_at: string;
  updated_at: string;
}

export interface OfflineDeckUserAccess extends OfflineMetadata {
  id: string;
  deck_id: string;
  user_id: string;
  granted_by: string;
  granted_at: string;
  created_at: string;
  updated_at: string;
}

export interface MetadataEntry {
  key: string;
  value: any;
  updated_at: string;
}

export interface DeckWithStats extends OfflineDeck {
  card_count?: number;
  new_count?: number;
  learning_count?: number;
  review_count?: number;
  due_count?: number;
  next_review_time?: string;
  total_studied?: number;
}

export interface StudySession {
  deck_id: string;
  cards: OfflineCard[];
  progress: Map<string, OfflineUserProgress>;
}

export interface ConflictResolution {
  strategy: 'local_wins' | 'remote_wins' | 'merge' | 'manual';
  local_data: any;
  remote_data: any;
  resolved_data?: any;
  resolved_at?: string;
}

export interface SyncResult {
  success: boolean;
  synced_count: number;
  failed_count: number;
  conflicts: ConflictResolution[];
  last_sync_timestamp: string;
}

export interface OfflineCapabilities {
  isOnline: boolean;
  hasLocalData: boolean;
  pendingSyncCount: number;
  lastSuccessfulSync?: string;
  nextScheduledSync?: string;
}