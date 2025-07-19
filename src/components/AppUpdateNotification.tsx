'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, X } from 'lucide-react';

export default function AppUpdateNotification() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [dismissedBuildTime, setDismissedBuildTime] = useState<string | null>(null);

  useEffect(() => {
    const handleUpdateAvailable = (event: any) => {
      setUpdateAvailable(true);
    };

    window.addEventListener('app-update-available', handleUpdateAvailable);
    
    return () => {
      window.removeEventListener('app-update-available', handleUpdateAvailable);
    };
  }, []);

  const handleUpdate = async () => {
    setIsUpdating(true);
    
    try {
      const { appUpdater } = await import('@/lib/app-updater');
      await appUpdater.forceUpdate();
    } catch (error) {
      console.error('Error updating app:', error);
      // Fallback to manual reload
      window.location.reload();
    }
  };

  const handleDismiss = () => {
    setUpdateAvailable(false);
  };

  if (!updateAvailable) return null;

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 shadow-lg">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <RefreshCw className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-semibold text-blue-800">
                App Update Available
              </h4>
              <p className="text-xs text-blue-600 mt-1">
                A new version is ready. Update now for the latest features and fixes.
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="h-6 w-6 p-0 text-blue-400 hover:text-blue-600"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        
        <div className="flex gap-2 mt-3">
          <Button
            onClick={handleUpdate}
            disabled={isUpdating}
            size="sm"
            className="flex-1"
          >
            {isUpdating ? (
              <>
                <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                Updating...
              </>
            ) : (
              'Update Now'
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDismiss}
            className="px-3"
          >
            Later
          </Button>
        </div>
      </div>
    </div>
  );
}