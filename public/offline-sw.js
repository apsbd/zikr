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
        '/app-shell.html',
        '/offline-study.html'
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
  
  // Only handle navigation requests
  if (request.mode !== 'navigate') return;
  
  // Handle study page navigation requests when offline
  if (url.pathname.startsWith('/study/') && !navigator.onLine) {
    console.log(`[Offline SW] Handling offline study page request: ${url.pathname}`);
    
    event.respondWith(
      (async () => {
        // First, try to get the exact page from cache
        const cachedPage = await caches.match(request, { ignoreSearch: true });
        if (cachedPage) {
          console.log('[Offline SW] Serving cached study page');
          return cachedPage;
        }
        
        // Try to serve the root page (Next.js will handle client routing)
        const rootPage = await caches.match('/', { ignoreSearch: true });
        if (rootPage) {
          console.log('[Offline SW] Serving root page for client-side routing');
          // Return the root page but preserve the URL
          return new Response(rootPage.body, {
            status: 200,
            statusText: 'OK',
            headers: rootPage.headers
          });
        }
        
        // Try the offline study page
        const offlineStudy = await caches.match('/offline-study.html');
        if (offlineStudy) {
          console.log('[Offline SW] Serving offline study page');
          return offlineStudy;
        }
        
        // Last resort - basic offline response
        console.log('[Offline SW] No cached content found');
        return new Response(
          '<html><body><h1>Offline</h1><p>Please go online to load this page first.</p></body></html>',
          {
            status: 200,
            headers: { 'Content-Type': 'text/html' }
          }
        );
      })()
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