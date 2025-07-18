# Offline-First Spaced Repetition System

This directory contains the complete offline-first implementation for the Zikr app, designed to provide seamless study experience regardless of network connectivity.

## Architecture Overview

The system follows a **local-first architecture** where:
- **IndexedDB** serves as the primary data source
- **Supabase** acts as a sync layer for persistence across devices
- **Service Workers** handle background sync and offline functionality
- **React hooks** provide optimistic updates and real-time UI

## Core Components

### 1. Data Layer (`indexeddb-service.ts`)
- **Purpose**: Direct IndexedDB operations with transaction safety
- **Key Features**:
  - CRUD operations for all entities
  - Batch operations for performance
  - Compound indexes for efficient queries
  - Automatic sync queue management

### 2. Offline Data Service (`offline-data-service.ts`)
- **Purpose**: High-level data operations and business logic
- **Key Features**:
  - User session management
  - Deck and card operations
  - Study progress tracking
  - Access control logic

### 3. Sync Engine (`sync-engine.ts`)
- **Purpose**: Manages data synchronization with Supabase
- **Key Features**:
  - Full sync on login
  - Incremental sync during usage
  - Conflict resolution (last-write-wins)
  - Background sync scheduling

### 4. Sync Queue (`sync-queue.ts`)
- **Purpose**: Manages offline operations and retry logic
- **Key Features**:
  - Persistent operation queue
  - Exponential backoff retry
  - Network-aware processing
  - Failure recovery

### 5. Main Service (`offline-service.ts`)
- **Purpose**: Single entry point for all offline operations
- **Key Features**:
  - Service initialization
  - Login/logout sync coordination
  - Optimistic updates
  - Network state management

## Database Schema

### Object Stores (Tables)
- `decks`: Deck metadata and configuration
- `cards`: Flashcard content (front, back_bangla, back_english)
- `user_progress`: FSRS spaced repetition data
- `user_profiles`: User metadata and roles
- `deck_user_access`: Access control for decks
- `sync_queue`: Pending sync operations
- `metadata`: System configuration and sync state

### Indexes
Each store has indexes optimized for:
- Primary key lookups
- Foreign key relationships
- Compound queries (e.g., user + due date)
- Sync status filtering

## Data Flow

### User Actions
```
User Action → Optimistic UI Update → Local DB Update → Sync Queue → Background Sync
```

### Server Changes
```
Server Update → Background Sync → Conflict Resolution → Local DB Update → UI Update
```

### Offline Operations
```
User Action → Local DB Update → Sync Queue → UI Update (immediate)
Network Available → Process Sync Queue → Server Update → Remove from Queue
```

## React Hooks

### `useOfflineService()`
- Initializes the offline service
- Monitors network status
- Provides capability information

### `useDecks()`
- Manages deck collection
- Provides CRUD operations
- Handles optimistic updates

### `useDeckCards(deckId)`
- Manages cards for a specific deck
- Provides card operations
- Auto-refreshes on changes

### `useUserProgress()`
- Handles optimistic progress updates
- Batches progress changes
- Manages sync conflicts

### `useStudySession(deckId)`
- Creates study session with cards and progress
- Provides real-time progress tracking
- Handles optimistic updates during study

### `useSyncStatus()`
- Monitors sync queue status
- Provides retry functionality
- Shows sync progress

## Key Features

### 1. Instant Loading
- App launches immediately from local data
- No loading states during normal usage
- Optimistic updates for all user actions

### 2. Seamless Offline Experience
- All study features work offline
- Changes queued for sync when online
- Transparent background synchronization

### 3. Conflict Resolution
- Last-write-wins strategy
- Automatic conflict detection
- Graceful handling of concurrent updates

### 4. Performance Optimizations
- Compound indexes for fast queries
- Batch operations for bulk updates
- Efficient sync with delta changes only
- Service worker caching for static assets

### 5. Error Handling
- Graceful degradation on sync failures
- Retry mechanisms with exponential backoff
- Data integrity checks
- Recovery from corruption

## Usage Examples

### Basic Setup
```typescript
import { offlineService } from '@/lib/offline';

// Initialize service
await offlineService.init();

// Login user (triggers full sync)
await offlineService.login(userId);

// Get decks (from local storage)
const decks = await offlineService.getDecks();
```

### Study Session
```typescript
import { useStudySession } from '@/lib/offline/hooks';

function StudyComponent({ deckId }) {
  const { 
    session, 
    updateCardProgress, 
    hasOptimisticUpdates 
  } = useStudySession(deckId);

  const handleAnswer = async (cardId, rating) => {
    // Optimistic update - UI changes immediately
    const newProgress = calculateFSRSProgress(rating);
    await updateCardProgress(newProgress);
    
    // Background sync happens automatically
  };
}
```

### Sync Status
```typescript
import { useSyncStatus } from '@/lib/offline/hooks';

function SyncIndicator() {
  const { syncStatus, retryFailedSync } = useSyncStatus();
  
  if (syncStatus.failedChanges > 0) {
    return (
      <button onClick={retryFailedSync}>
        Retry {syncStatus.failedChanges} failed syncs
      </button>
    );
  }
}
```

## Migration Guide

### From Old System
1. **Replace direct Supabase calls** with `offlineService` methods
2. **Remove loading states** from UI components
3. **Use React hooks** for data management
4. **Update components** to handle optimistic updates
5. **Add sync indicators** only for login/logout flows

### Component Updates
```typescript
// Before
const [decks, setDecks] = useState([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  async function fetchDecks() {
    const { data } = await supabase.from('decks').select('*');
    setDecks(data);
    setLoading(false);
  }
  fetchDecks();
}, []);

// After
const { decks, loading } = useDecks();
// No useEffect needed - hook manages everything
```

## Testing

### Unit Tests
- IndexedDB operations
- Sync queue logic
- Conflict resolution
- FSRS calculations

### Integration Tests
- Full sync scenarios
- Offline/online transitions
- Concurrent user actions
- Data consistency

### Performance Tests
- Large deck collections
- Bulk progress updates
- Sync queue processing
- Memory usage

## Troubleshooting

### Common Issues

1. **Sync Queue Stuck**
   - Check network connectivity
   - Verify Supabase credentials
   - Clear and retry failed items

2. **Data Inconsistency**
   - Force full sync
   - Check for schema changes
   - Verify conflict resolution

3. **Performance Issues**
   - Monitor IndexedDB size
   - Check for excessive sync operations
   - Optimize query patterns

### Debug Tools
```typescript
// Check sync status
const status = await offlineService.getSyncStatus();

// Export data for debugging
const data = await offlineService.exportData();

// Clear all local data
await offlineService.clearAllData();
```

## Future Enhancements

1. **Advanced Conflict Resolution**
   - Three-way merge
   - User-driven conflict resolution
   - Operational transforms

2. **Performance Optimizations**
   - Web Workers for heavy operations
   - Progressive sync for large datasets
   - Intelligent prefetching

3. **Enhanced Offline Features**
   - Offline deck creation
   - Local import/export
   - Peer-to-peer sync

4. **Monitoring and Analytics**
   - Sync performance metrics
   - Offline usage patterns
   - Error tracking and reporting

## Support

For issues or questions about the offline system:
1. Check the troubleshooting guide
2. Review the sync status indicators
3. Enable debug logging
4. Export data for analysis

The offline-first architecture ensures that users can study their flashcards anytime, anywhere, with automatic synchronization when connectivity is restored.