// Simple offline service worker that actually works
console.log('[Simple SW] Loading simple offline service worker');

// Cache name for study pages - increment version to force cache update
const CACHE_NAME = 'study-pages-v5';
const urlsToCache = [
  '/',
  '/offline.html',
  '/offline-study',
  '/offline-study-static.html'
];

// Listen for skip waiting message
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[Simple SW] Received SKIP_WAITING, activating immediately');
    self.skipWaiting();
  }
});

// Helper to determine if a request is for a study page
function isStudyPageRequest(request) {
  const url = new URL(request.url);
  // More permissive check for study pages
  return url.pathname.startsWith('/study/') && 
         (request.mode === 'navigate' || 
          request.destination === 'document' || 
          request.headers.get('accept')?.includes('text/html') ||
          request.headers.get('X-Cache-Request') === 'true');
}

// Install event - cache essential files
self.addEventListener('install', (event) => {
  console.log('[Simple SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Simple SW] Caching app shell');
      return cache.addAll(urlsToCache);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Simple SW] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName.startsWith('study-pages')) {
            console.log('[Simple SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-http(s) requests
  if (!url.protocol.startsWith('http')) {
    return;
  }
  
  // Handle study page requests
  if (isStudyPageRequest(request)) {
    console.log('[Simple SW] Handling study page request:', url.pathname);
    
    event.respondWith(
      // Try network first
      fetch(request)
        .then((response) => {
          // Cache successful HTML responses
          if (response && response.status === 200) {
            const contentType = response.headers.get('content-type') || '';
            if (contentType.includes('text/html')) {
              const responseToCache = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                console.log('[Simple SW] Caching study page:', url.pathname);
                // Cache with both the full URL and pathname
                cache.put(request, responseToCache.clone());
                cache.put(url.pathname, responseToCache);
              });
            }
          }
          return response;
        })
        .catch((error) => {
          // When offline, try to serve from cache
          console.log('[Simple SW] Network failed, checking cache for:', url.pathname);
          console.log('[Simple SW] Error:', error.message);
          
          // Try multiple cache strategies
          return caches.match(request, { ignoreSearch: true })
            .then((response) => {
              if (response) {
                console.log('[Simple SW] Found in cache (ignoring search params)!');
                return response;
              }
              
              // Try with just the pathname
              return caches.match(url.pathname);
            })
            .then((response) => {
              if (response) {
                console.log('[Simple SW] Found in cache with pathname!');
                return response;
              }
              
              // Try to find any study page in cache
              return caches.open(CACHE_NAME).then(cache => {
                return cache.keys().then(keys => {
                  console.log('[Simple SW] Cache keys:', keys.map(k => k.url));
                  
                  // Find a study page that matches the deck ID
                  const studyKey = keys.find(key => {
                    const keyUrl = new URL(key.url);
                    return keyUrl.pathname === url.pathname;
                  });
                  
                  if (studyKey) {
                    console.log('[Simple SW] Found matching study page in cache');
                    return cache.match(studyKey);
                  }
                  
                  // If no exact match, return static offline-study page
                  console.log('[Simple SW] No cached study page, returning offline-study-static');
                  return caches.match('/offline-study-static.html?path=' + encodeURIComponent(url.pathname))
                    .then(response => {
                      if (response) {
                        // Clone and modify the response to include the path parameter
                        return response;
                      }
                      return caches.match('/offline.html');
                    });
                });
              });
            });
        })
    );
    return;
  }
  
  // For other navigation requests to our domain
  if (request.mode === 'navigate' && url.origin === location.origin) {
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match(request).then((cachedResponse) => {
          return cachedResponse || caches.match('/offline.html');
        });
      })
    );
  }
});

console.log('[Simple SW] Simple offline service worker loaded');