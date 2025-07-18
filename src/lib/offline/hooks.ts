import { useEffect, useState, useCallback } from 'react';
import { offlineService } from './offline-service';
import type { 
  DeckWithStats, 
  OfflineCard, 
  OfflineUserProgress, 
  OfflineCapabilities 
} from './types';

export function useOfflineService() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [capabilities, setCapabilities] = useState<OfflineCapabilities>({
    isOnline: navigator.onLine,
    hasLocalData: false,
    pendingSyncCount: 0
  });

  useEffect(() => {
    const initService = async () => {
      try {
        await offlineService.init();
        setIsInitialized(true);
        
        const caps = await offlineService.getOfflineCapabilities();
        setCapabilities(caps);
      } catch (error) {
        console.error('Failed to initialize offline service:', error);
      }
    };

    initService();

    const removeNetworkListener = offlineService.onNetworkChange((online) => {
      setIsOnline(online);
    });

    return () => {
      removeNetworkListener();
    };
  }, []);

  const refreshCapabilities = useCallback(async () => {
    try {
      const caps = await offlineService.getOfflineCapabilities();
      setCapabilities(caps);
    } catch (error) {
      console.error('Failed to refresh capabilities:', error);
    }
  }, []);

  return {
    isInitialized,
    isOnline,
    capabilities,
    refreshCapabilities
  };
}

export function useDecks() {
  const [decks, setDecks] = useState<DeckWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDecks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const deckList = await offlineService.getDecks();
      setDecks(deckList);
    } catch (err) {
      console.error('Failed to load decks:', err);
      setError(err instanceof Error ? err.message : 'Failed to load decks');
    } finally {
      setLoading(false);
    }
  }, []);

  const createDeck = useCallback(async (deckData: {
    title: string;
    description?: string;
    author: string;
    daily_new_limit?: number;
    group_access_enabled?: boolean;
    is_public?: boolean;
  }) => {
    try {
      const newDeck = await offlineService.createDeck(deckData);
      setDecks(prev => [...prev, newDeck]);
      return newDeck;
    } catch (err) {
      console.error('Failed to create deck:', err);
      throw err;
    }
  }, []);

  const deleteDeck = useCallback(async (deckId: string) => {
    try {
      await offlineService.deleteDeck(deckId);
      setDecks(prev => prev.filter(deck => deck.id !== deckId));
    } catch (err) {
      console.error('Failed to delete deck:', err);
      throw err;
    }
  }, []);

  useEffect(() => {
    loadDecks();
  }, [loadDecks]);

  return {
    decks,
    loading,
    error,
    loadDecks,
    createDeck,
    deleteDeck
  };
}

export function useDeckCards(deckId: string) {
  const [cards, setCards] = useState<OfflineCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCards = useCallback(async () => {
    if (!deckId) return;
    
    try {
      setLoading(true);
      setError(null);
      const cardList = await offlineService.getDeckCards(deckId);
      setCards(cardList);
    } catch (err) {
      console.error('Failed to load cards:', err);
      setError(err instanceof Error ? err.message : 'Failed to load cards');
    } finally {
      setLoading(false);
    }
  }, [deckId]);

  const createCard = useCallback(async (cardData: {
    front: string;
    back_bangla: string;
    back_english: string;
  }) => {
    try {
      const newCard = await offlineService.createCard({
        ...cardData,
        deck_id: deckId
      });
      setCards(prev => [...prev, newCard]);
      return newCard;
    } catch (err) {
      console.error('Failed to create card:', err);
      throw err;
    }
  }, [deckId]);

  const updateCard = useCallback(async (card: OfflineCard) => {
    try {
      const updatedCard = await offlineService.updateCard(card);
      setCards(prev => prev.map(c => c.id === card.id ? updatedCard : c));
      return updatedCard;
    } catch (err) {
      console.error('Failed to update card:', err);
      throw err;
    }
  }, []);

  const deleteCard = useCallback(async (cardId: string) => {
    try {
      await offlineService.deleteCard(cardId);
      setCards(prev => prev.filter(card => card.id !== cardId));
    } catch (err) {
      console.error('Failed to delete card:', err);
      throw err;
    }
  }, []);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  return {
    cards,
    loading,
    error,
    loadCards,
    createCard,
    updateCard,
    deleteCard
  };
}

export function useUserProgress() {
  const [optimisticUpdates, setOptimisticUpdates] = useState<Map<string, OfflineUserProgress>>(new Map());

  const updateProgress = useCallback(async (progress: OfflineUserProgress) => {
    try {
      // Apply optimistic update immediately
      setOptimisticUpdates(prev => new Map(prev).set(progress.id, progress));
      
      // Perform actual update
      const updatedProgress = await offlineService.updateUserProgress(progress);
      
      // Remove from optimistic updates once successful
      setOptimisticUpdates(prev => {
        const newMap = new Map(prev);
        newMap.delete(progress.id);
        return newMap;
      });
      
      return updatedProgress;
    } catch (err) {
      // Remove failed optimistic update
      setOptimisticUpdates(prev => {
        const newMap = new Map(prev);
        newMap.delete(progress.id);
        return newMap;
      });
      
      console.error('Failed to update progress:', err);
      throw err;
    }
  }, []);

  const batchUpdateProgress = useCallback(async (progressList: OfflineUserProgress[]) => {
    try {
      // Apply optimistic updates immediately
      setOptimisticUpdates(prev => {
        const newMap = new Map(prev);
        progressList.forEach(progress => {
          newMap.set(progress.id, progress);
        });
        return newMap;
      });
      
      // Perform actual batch update
      const updatedProgress = await offlineService.batchUpdateUserProgress(progressList);
      
      // Remove from optimistic updates once successful
      setOptimisticUpdates(prev => {
        const newMap = new Map(prev);
        progressList.forEach(progress => {
          newMap.delete(progress.id);
        });
        return newMap;
      });
      
      return updatedProgress;
    } catch (err) {
      // Remove failed optimistic updates
      setOptimisticUpdates(prev => {
        const newMap = new Map(prev);
        progressList.forEach(progress => {
          newMap.delete(progress.id);
        });
        return newMap;
      });
      
      console.error('Failed to batch update progress:', err);
      throw err;
    }
  }, []);

  return {
    optimisticUpdates,
    updateProgress,
    batchUpdateProgress
  };
}

export function useStudySession(deckId: string) {
  const [session, setSession] = useState<{
    cards: OfflineCard[];
    progress: Map<string, OfflineUserProgress>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { optimisticUpdates, updateProgress, batchUpdateProgress } = useUserProgress();

  const loadSession = useCallback(async () => {
    if (!deckId) return;
    
    try {
      setLoading(true);
      setError(null);
      const studySession = await offlineService.getStudySession(deckId);
      setSession(studySession);
    } catch (err) {
      console.error('Failed to load study session:', err);
      setError(err instanceof Error ? err.message : 'Failed to load study session');
    } finally {
      setLoading(false);
    }
  }, [deckId]);

  const getCurrentProgress = useCallback((cardId: string): OfflineUserProgress | undefined => {
    // Check optimistic updates first
    const optimisticProgress = optimisticUpdates.get(cardId);
    if (optimisticProgress) {
      return optimisticProgress;
    }
    
    // Fall back to session progress
    return session?.progress.get(cardId);
  }, [optimisticUpdates, session]);

  const updateCardProgress = useCallback(async (progress: OfflineUserProgress) => {
    const updatedProgress = await updateProgress(progress);
    
    // Update session progress
    if (session) {
      setSession(prev => {
        if (!prev) return prev;
        const newProgress = new Map(prev.progress);
        newProgress.set(progress.card_id, updatedProgress);
        return {
          ...prev,
          progress: newProgress
        };
      });
    }
    
    return updatedProgress;
  }, [updateProgress, session]);

  const batchUpdateCardProgress = useCallback(async (progressList: OfflineUserProgress[]) => {
    const updatedProgress = await batchUpdateProgress(progressList);
    
    // Update session progress
    if (session) {
      setSession(prev => {
        if (!prev) return prev;
        const newProgress = new Map(prev.progress);
        updatedProgress.forEach(progress => {
          newProgress.set(progress.card_id, progress);
        });
        return {
          ...prev,
          progress: newProgress
        };
      });
    }
    
    return updatedProgress;
  }, [batchUpdateProgress, session]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  return {
    session,
    loading,
    error,
    loadSession,
    getCurrentProgress,
    updateCardProgress,
    batchUpdateCardProgress,
    hasOptimisticUpdates: optimisticUpdates.size > 0
  };
}

export function useSyncStatus() {
  const [syncStatus, setSyncStatus] = useState<{
    isOnline: boolean;
    lastFullSync?: string;
    lastSuccessfulSync?: string;
    pendingChanges: number;
    failedChanges: number;
    isFullSyncRunning: boolean;
  }>({
    isOnline: navigator.onLine,
    pendingChanges: 0,
    failedChanges: 0,
    isFullSyncRunning: false
  });

  const [error, setError] = useState<string | null>(null);

  const refreshSyncStatus = useCallback(async () => {
    try {
      const status = await offlineService.getSyncStatus();
      setSyncStatus(status);
      setError(null);
    } catch (err) {
      console.error('Failed to get sync status:', err);
      setError(err instanceof Error ? err.message : 'Failed to get sync status');
    }
  }, []);

  const retryFailedSync = useCallback(async () => {
    try {
      await offlineService.retryFailedSync();
      await refreshSyncStatus();
    } catch (err) {
      console.error('Failed to retry sync:', err);
      setError(err instanceof Error ? err.message : 'Failed to retry sync');
    }
  }, [refreshSyncStatus]);

  useEffect(() => {
    refreshSyncStatus();
    
    // Refresh status every 30 seconds
    const interval = setInterval(refreshSyncStatus, 30000);
    
    return () => clearInterval(interval);
  }, [refreshSyncStatus]);

  return {
    syncStatus,
    error,
    refreshSyncStatus,
    retryFailedSync
  };
}