// Simple offline service worker that actually works
console.log('[Simple SW] Loading simple offline service worker');

// Cache name for study pages
const CACHE_NAME = 'study-pages-v3';
const urlsToCache = [
  '/',
  '/offline.html'
];

// Helper to determine if a request is for a study page
function isStudyPageRequest(request) {
  const url = new URL(request.url);
  return url.pathname.startsWith('/study/') && 
         (request.mode === 'navigate' || 
          request.destination === 'document' || 
          request.headers.get('accept')?.includes('text/html'));
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
          if (response && response.status === 200 && response.headers.get('content-type')?.includes('text/html')) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              console.log('[Simple SW] Caching study page:', url.pathname);
              // Cache with the pathname as key for consistency
              const cacheKey = new Request(url.pathname, {
                method: 'GET',
                headers: {'Content-Type': 'text/html'}
              });
              cache.put(cacheKey, responseToCache);
            });
          }
          return response;
        })
        .catch((error) => {
          // When offline, try to serve from cache
          console.log('[Simple SW] Network failed, checking cache for:', url.pathname);
          
          // Try with the pathname key first
          const cacheKey = new Request(url.pathname, {
            method: 'GET',
            headers: {'Content-Type': 'text/html'}
          });
          
          return caches.match(cacheKey).then((cachedResponse) => {
            if (cachedResponse) {
              console.log('[Simple SW] Found in cache with pathname key!');
              return cachedResponse;
            }
            
            // Try original request
            return caches.match(request).then((cachedResponse2) => {
              if (cachedResponse2) {
                console.log('[Simple SW] Found in cache with original request!');
                return cachedResponse2;
              }
              
              // Try any study page in cache as fallback
              return caches.open(CACHE_NAME).then(cache => {
                return cache.keys().then(keys => {
                  const studyKey = keys.find(key => key.url.includes('/study/'));
                  if (studyKey) {
                    console.log('[Simple SW] Using fallback study page from cache');
                    return cache.match(studyKey);
                  }
                  
                  // Last resort: offline page
                  console.log('[Simple SW] No cached study page, returning offline page');
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