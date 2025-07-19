'use client';

import { useEffect } from 'react';
import { useAuth } from '@/contexts/auth';

export function OfflineCacheManager() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user || !('serviceWorker' in navigator)) return;

    const cacheEssentialPages = async () => {
      try {
        // Get all user's decks from IndexedDB
        const { offlineService } = await import('@/lib/offline');
        await offlineService.init();
        const decks = await offlineService.getDecks() || [];

        // List of essential pages to cache
        const pagesToCache = [
          '/',
          '/offline-study',
          // Add study pages for each deck
          ...decks.map((deck: any) => `/study/${deck.id}`)
        ];

        // Send message to service worker to cache these pages
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'CACHE_URLS',
            urls: pagesToCache
          });
        }

        // Pre-fetch pages to ensure they're cached
        for (const page of pagesToCache) {
          try {
            await fetch(page, { 
              mode: 'no-cors',
              cache: 'force-cache' 
            });
          } catch (error) {
            console.log(`Failed to pre-cache ${page}:`, error);
          }
        }

        console.log('✅ Essential pages cached for offline use');
      } catch (error) {
        console.error('Failed to cache essential pages:', error);
      }
    };

    // Cache pages after a short delay
    const timer = setTimeout(cacheEssentialPages, 2000);
    return () => clearTimeout(timer);
  }, [user]);

  return null;
}