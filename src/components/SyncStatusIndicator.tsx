'use client';

import { useEffect, useState } from 'react';
import { useSyncStatus } from '@/contexts/sync-status';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, CheckCircle, Clock, RefreshCw, Wifi, WifiOff } from 'lucide-react';

interface SyncStatusIndicatorProps {
  showDuringAuth?: boolean;
  showPersistent?: boolean;
  className?: string;
}

export function SyncStatusIndicator({ 
  showDuringAuth = false, 
  showPersistent = false,
  className = ''
}: SyncStatusIndicatorProps) {
  const { 
    isOnline, 
    isFullSyncRunning, 
    failedChanges, 
    pendingChanges,
    lastSuccessfulSync,
    error, 
    retryFailedSync 
  } = useSyncStatus();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (showPersistent) {
      setIsVisible(true);
      return;
    }

    // Only show during auth flows or when there are issues
    const shouldShow = showDuringAuth || 
                     isFullSyncRunning || 
                     failedChanges > 0 || 
                     !isOnline;
    
    setIsVisible(shouldShow);
  }, [showDuringAuth, showPersistent, isFullSyncRunning, failedChanges, isOnline]);

  if (!isVisible) return null;

  const renderSyncStatus = () => {
    if (isFullSyncRunning) {
      return (
        <div className="flex items-center space-x-3">
          <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
          <div>
            <p className="text-sm font-medium text-blue-700">
              Syncing your data...
            </p>
            <p className="text-xs text-blue-600">
              This may take a moment during login
            </p>
          </div>
        </div>
      );
    }

    if (!isOnline) {
      return (
        <div className="flex items-center space-x-3">
          <WifiOff className="w-5 h-5 text-amber-600" />
          <div>
            <p className="text-sm font-medium text-amber-700">
              Working offline
            </p>
            <p className="text-xs text-amber-600">
              Changes will sync when reconnected
            </p>
          </div>
        </div>
      );
    }

    if (failedChanges > 0) {
      return (
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <div>
              <p className="text-sm font-medium text-red-700">
                Sync failed for {failedChanges} items
              </p>
              <p className="text-xs text-red-600">
                Check your connection and try again
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={retryFailedSync}
            className="ml-3"
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Retry
          </Button>
        </div>
      );
    }

    if (pendingChanges > 0) {
      return (
        <div className="flex items-center space-x-3">
          <Clock className="w-5 h-5 text-yellow-600" />
          <div>
            <p className="text-sm font-medium text-yellow-700">
              {pendingChanges} changes pending sync
            </p>
            <p className="text-xs text-yellow-600">
              Will sync automatically when online
            </p>
          </div>
        </div>
      );
    }

    if (lastSuccessfulSync) {
      const lastSync = new Date(lastSuccessfulSync);
      const now = new Date();
      const diffMs = now.getTime() - lastSync.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      
      return (
        <div className="flex items-center space-x-3">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <div>
            <p className="text-sm font-medium text-green-700">
              All data synced
            </p>
            <p className="text-xs text-green-600">
              {diffMins < 1 ? 'Just now' : `${diffMins} minutes ago`}
            </p>
          </div>
        </div>
      );
    }

    return null;
  };

  const getStatusColor = () => {
    if (isFullSyncRunning) return 'bg-blue-50 border-blue-200';
    if (!isOnline) return 'bg-amber-50 border-amber-200';
    if (failedChanges > 0) return 'bg-red-50 border-red-200';
    if (pendingChanges > 0) return 'bg-yellow-50 border-yellow-200';
    return 'bg-green-50 border-green-200';
  };

  return (
    <div className={`rounded-lg border p-4 ${getStatusColor()} ${className}`}>
      {renderSyncStatus()}
      {error && (
        <div className="mt-2 text-xs text-red-600">
          Error: {error}
        </div>
      )}
    </div>
  );
}

export function NetworkStatusBadge() {
  const { isOnline } = useSyncStatus();
  
  if (isOnline) {
    return (
      <div className="flex items-center space-x-1 text-green-600">
        <Wifi className="w-4 h-4" />
        <span className="text-xs">Online</span>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-1 text-amber-600">
      <WifiOff className="w-4 h-4" />
      <span className="text-xs">Offline</span>
    </div>
  );
}

export function SyncProgressBar() {
  const { isFullSyncRunning, pendingChanges } = useSyncStatus();
  
  if (!isFullSyncRunning && pendingChanges === 0) {
    return null;
  }

  const progress = isFullSyncRunning ? 50 : 100;
  
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-muted-foreground mb-1">
        <span>
          {isFullSyncRunning ? 'Syncing...' : 'Pending sync'}
        </span>
        <span>
          {pendingChanges} items
        </span>
      </div>
      <Progress value={progress} className="h-1" />
    </div>
  );
}