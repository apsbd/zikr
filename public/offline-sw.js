// Custom service worker for offline functionality
// This extends the existing workbox service worker

// Background sync event
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(performBackgroundSync());
  }
});

async function performBackgroundSync() {
  try {
    // Notify the main thread that sync is required
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_REQUIRED'
      });
    });
  } catch (error) {
    console.error('Background sync failed:', error);
  }
}

// Message event - handle messages from main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Handle network status changes
self.addEventListener('online', () => {
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: 'NETWORK_STATUS_CHANGE',
        isOnline: true
      });
    });
  });
});

self.addEventListener('offline', () => {
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: 'NETWORK_STATUS_CHANGE',
        isOnline: false
      });
    });
  });
});

// Fetch event - handle API requests for offline functionality
self.addEventListener('fetch', (event) => {
  // Only handle API requests to database backend
  if (event.request.url.includes('database.backend.co') && event.request.method === 'GET') {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          // If network request fails, return a custom offline response
          return new Response(JSON.stringify({
            error: 'Network error - working offline',
            offline: true
          }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          });
        })
    );
  }
});

console.log('Offline Service Worker loaded');