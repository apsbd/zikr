// Custom fallback handler that allows study pages to work offline
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Special handling for study pages when offline
  if (!navigator.onLine && url.pathname.startsWith('/study/') && event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request)
        .catch(async () => {
          // Try to get from cache first
          const cache = await caches.open('pages');
          const cachedResponse = await cache.match(event.request);
          if (cachedResponse) {
            return cachedResponse;
          }
          
          // Return app shell for study pages
          const appShellResponse = await caches.match('/app-shell.html');
          if (appShellResponse) {
            return appShellResponse;
          }
          
          // Fallback to offline page
          return caches.match('/offline.html');
        })
    );
  }
});

// Override the default fallback behavior
self.fallback = async (request) => {
  const url = new URL(request.url);
  
  // For study pages, return the app shell instead of offline.html
  if (url.pathname.startsWith('/study/') && request.destination === 'document') {
    const appShellResponse = await caches.match('/app-shell.html');
    if (appShellResponse) {
      return appShellResponse;
    }
  }
  
  // For other document requests, use the offline.html fallback
  if (request.destination === 'document') {
    return caches.match('/offline.html', { ignoreSearch: true });
  }
  
  return Response.error();
};