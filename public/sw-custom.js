// Custom fallback handler that allows study pages to work offline
// Override the default fallback behavior for Workbox
self.fallback = async (request) => {
  try {
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
      const offlineResponse = await caches.match('/offline.html', { ignoreSearch: true });
      if (offlineResponse) {
        return offlineResponse;
      }
    }
    
    // Return a proper error response instead of Response.error()
    return new Response('Network error', {
      status: 408,
      statusText: 'Request Timeout',
      headers: new Headers({
        'Content-Type': 'text/plain'
      })
    });
  } catch (error) {
    console.error('Fallback error:', error);
    // Return a valid Response object on error
    return new Response('Fallback error', {
      status: 500,
      statusText: 'Internal Server Error',
      headers: new Headers({
        'Content-Type': 'text/plain'
      })
    });
  }
};