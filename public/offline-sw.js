// Offline-first service worker enhancements
console.log('[Offline SW] Loading offline service worker enhancements...');

// Store the original fetch handler
const originalFetch = self.fetch;

// Add event listener for message events (for cache management)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CACHE_STUDY_PAGE') {
    const url = event.data.url;
    caches.open('study-pages').then(cache => {
      cache.add(url).then(() => {
        console.log(`[Offline SW] Cached study page: ${url}`);
      });
    });
  }
});

// Override the fallback function to better handle offline scenarios
self.addEventListener('install', (event) => {
  console.log('[Offline SW] Installing offline enhancements...');
  // Cache critical assets during install
  event.waitUntil(
    caches.open('offline-assets').then(cache => {
      return cache.addAll([
        '/',
        '/offline.html',
        '/app-shell.html'
      ]).catch(err => {
        console.error('[Offline SW] Failed to cache assets:', err);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  console.log('[Offline SW] Activating offline enhancements...');
  event.waitUntil(clients.claim());
});

// Better offline handling for navigation requests
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip handling if not a navigation request
  if (request.mode !== 'navigate') return;
  
  // Handle study page navigation requests
  if (url.pathname.startsWith('/study/')) {
    console.log(`[Offline SW] Intercepting study page request: ${url.pathname}`);
    
    event.respondWith(
      // Try network first
      fetch(request)
        .then(response => {
          // Cache successful responses
          if (response.ok) {
            const responseToCache = response.clone();
            caches.open('study-pages').then(cache => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        })
        .catch(async () => {
          console.log(`[Offline SW] Network failed for: ${url.pathname}, trying offline fallbacks`);
          
          // Try exact match from cache first
          const cachedResponse = await caches.match(request, { ignoreSearch: true });
          if (cachedResponse) {
            console.log('[Offline SW] Found exact cached page');
            return cachedResponse;
          }
          
          // Try to get cached root page (Next.js app shell)
          const rootResponse = await caches.match('/', { ignoreSearch: true });
          if (rootResponse) {
            console.log('[Offline SW] Returning cached root for client-side routing');
            return rootResponse;
          }
          
          // Try the app shell
          const appShellResponse = await caches.match('/app-shell.html');
          if (appShellResponse) {
            console.log('[Offline SW] Returning app shell');
            return appShellResponse;
          }
          
          // Last resort - offline page
          console.log('[Offline SW] Returning offline page as last resort');
          const offlineResponse = await caches.match('/offline.html');
          return offlineResponse || new Response('Offline', { status: 503 });
        })
    );
  }
});

// Block Supabase requests when offline
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  if (url.hostname.includes('supabase.co') && !navigator.onLine) {
    console.log(`[Offline SW] Blocking Supabase request while offline: ${url.pathname}`);
    event.respondWith(
      new Response(JSON.stringify({ error: 'Offline' }), {
        status: 503,
        statusText: 'Service Unavailable',
        headers: {
          'Content-Type': 'application/json'
        }
      })
    );
  }
});

console.log('[Offline SW] Offline service worker enhancements loaded');