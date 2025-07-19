// Custom offline handler for Zikr app
self.addEventListener('install', (event) => {
  console.log('[SW] Installing offline handler...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating offline handler...');
  event.waitUntil(clients.claim());
});


// Cache API responses for offline use
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle Supabase API calls
  if (url.origin.includes('supabase.co') && !url.pathname.includes('/auth/')) {
    event.respondWith(
      caches.match(request).then(cachedResponse => {
        const fetchPromise = fetch(request).then(networkResponse => {
          // Cache successful responses
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open('supabase-data').then(cache => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        }).catch(() => {
          // Return cached response when offline
          if (cachedResponse) {
            console.log('[SW] Returning cached Supabase data for:', url.pathname);
            return cachedResponse;
          }
          // Return offline response
          return new Response(JSON.stringify({ error: 'Offline' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          });
        });

        // Return cached response immediately, update cache in background
        return cachedResponse || fetchPromise;
      })
    );
  }
});

// Pre-cache critical resources on service worker install
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CACHE_URLS') {
    const urlsToCache = event.data.urls || [];
    event.waitUntil(
      caches.open('app-pages').then(cache => {
        return cache.addAll(urlsToCache);
      })
    );
  }
});