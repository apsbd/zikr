'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { offlineService } from '@/lib/offline';

interface SyncStatusContextType {
  isOnline: boolean;
  isFullSyncRunning: boolean;
  isSyncing: boolean;
  lastFullSync?: string;
  lastSuccessfulSync?: string;
  pendingChanges: number;
  failedChanges: number;
  error: string | null;
  refreshStatus: () => Promise<void>;
  retryFailedSync: () => Promise<void>;
}

const SyncStatusContext = createContext<SyncStatusContextType | undefined>(undefined);

export function SyncStatusProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState<{
    lastFullSync?: string;
    lastSuccessfulSync?: string;
    pendingChanges: number;
    failedChanges: number;
    isFullSyncRunning: boolean;
  }>({
    pendingChanges: 0,
    failedChanges: 0,
    isFullSyncRunning: false
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    try {
      const status = await offlineService.getSyncStatus();
      setSyncStatus(status);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get sync status');
    }
  }, []);

  const retryFailedSync = useCallback(async () => {
    try {
      setIsSyncing(true);
      await offlineService.retryFailedSync();
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retry sync');
    } finally {
      setIsSyncing(false);
    }
  }, [refreshStatus]);

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      refreshStatus();
    };
    
    const handleOffline = () => {
      setIsOnline(false);
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Set up network change listener from offline service
    const removeListener = offlineService.onNetworkChange((online) => {
      setIsOnline(online);
      if (online) {
        refreshStatus();
      }
    });
    
    // Initial status refresh
    refreshStatus();
    
    // Refresh status periodically when online
    const intervalId = setInterval(() => {
      if (navigator.onLine) {
        refreshStatus();
      }
    }, 30000); // Every 30 seconds
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      removeListener();
      clearInterval(intervalId);
    };
  }, [refreshStatus]);

  const value: SyncStatusContextType = {
    isOnline,
    isFullSyncRunning: syncStatus.isFullSyncRunning,
    isSyncing: isSyncing || syncStatus.isFullSyncRunning,
    lastFullSync: syncStatus.lastFullSync,
    lastSuccessfulSync: syncStatus.lastSuccessfulSync,
    pendingChanges: syncStatus.pendingChanges,
    failedChanges: syncStatus.failedChanges,
    error,
    refreshStatus,
    retryFailedSync,
  };

  return (
    <SyncStatusContext.Provider value={value}>
      {children}
    </SyncStatusContext.Provider>
  );
}

export function useSyncStatus() {
  const context = useContext(SyncStatusContext);
  if (context === undefined) {
    throw new Error('useSyncStatus must be used within a SyncStatusProvider');
  }
  return context;
}