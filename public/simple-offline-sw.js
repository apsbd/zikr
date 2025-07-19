// Minimal offline service worker - no caching, only IndexedDB
console.log('[Minimal SW] Loading minimal offline service worker');

// Listen for skip waiting message
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[Minimal SW] Received SKIP_WAITING, activating immediately');
    self.skipWaiting();
  }
});

// Install event - skip waiting immediately
self.addEventListener('install', (event) => {
  console.log('[Minimal SW] Installing...');
  self.skipWaiting();
});

// Activate event - take control immediately
self.addEventListener('activate', (event) => {
  console.log('[Minimal SW] Activating...');
  event.waitUntil(clients.claim());
});

// Fetch event - always try network, no caching
self.addEventListener('fetch', (event) => {
  // For offline requests, let the app handle it via IndexedDB
  // The service worker doesn't cache anything
  event.respondWith(
    fetch(event.request).catch(() => {
      // If offline and it's a navigation request, return offline page
      if (event.request.mode === 'navigate') {
        return caches.match('/offline.html').catch(() => {
          // If offline.html is not cached, return a basic offline response
          return new Response('Offline - Please check your connection', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({
              'Content-Type': 'text/plain'
            })
          });
        });
      }
      // For other requests, just fail
      return Promise.reject('Offline');
    })
  );
});