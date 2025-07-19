/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: false, // Enable PWA in all environments for offline testing
  buildExcludes: [/app-build-manifest\.json$/], // Exclude problematic files
  importScripts: ['/sw-offline-handler.js'], // Import our custom offline handler
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/fonts\.(?:gstatic)\.com\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'google-fonts-webfonts',
        expiration: {
          maxEntries: 4,
          maxAgeSeconds: 365 * 24 * 60 * 60 // 365 days
        }
      }
    },
    {
      urlPattern: /^https:\/\/fonts\.(?:googleapis)\.com\/.*/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'google-fonts-stylesheets',
        expiration: {
          maxEntries: 4,
          maxAgeSeconds: 7 * 24 * 60 * 60 // 7 days
        }
      }
    },
    {
      urlPattern: /\.(?:eot|otf|ttc|ttf|woff|woff2|font.css)$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-font-assets',
        expiration: {
          maxEntries: 4,
          maxAgeSeconds: 7 * 24 * 60 * 60 // 7 days
        }
      }
    },
    {
      urlPattern: /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-image-assets',
        expiration: {
          maxEntries: 64,
          maxAgeSeconds: 24 * 60 * 60 // 24 hours
        }
      }
    },
    {
      urlPattern: /\/_next\/static.+\.js$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'next-static-js',
        expiration: {
          maxEntries: 64,
          maxAgeSeconds: 24 * 60 * 60 // 24 hours
        }
      }
    },
    {
      urlPattern: /\/_next\/static.+\.css$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'next-static-css',
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 24 * 60 * 60 // 24 hours
        }
      }
    },
    {
      urlPattern: /\/_next\/image\?url=.+$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'next-image',
        expiration: {
          maxEntries: 64,
          maxAgeSeconds: 24 * 60 * 60 // 24 hours
        }
      }
    },
    // Ensure API routes are never cached
    {
      urlPattern: /^\/api\//,
      handler: 'NetworkOnly',
      options: {}
    },
    {
      urlPattern: ({ url }) => {
        // Only cache JSON files that are NOT API routes
        return url.pathname.endsWith('.json') && !url.pathname.startsWith('/api/');
      },
      handler: 'NetworkFirst',
      options: {
        cacheName: 'apis',
        expiration: {
          maxEntries: 16,
          maxAgeSeconds: 24 * 60 * 60 // 24 hours
        },
        networkTimeoutSeconds: 10 // fallback to cache if network is slow
      }
    },
    {
      urlPattern: ({ request }) => request.destination === 'document',
      handler: 'NetworkFirst',
      options: {
        cacheName: 'pages',
        plugins: [
          {
            cacheWillUpdate: async ({ response }) => {
              if (response && response.status === 200) {
                return response;
              }
              return null;
            }
          }
        ],
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 24 * 60 * 60 // 24 hours
        },
        networkTimeoutSeconds: 3 // Fallback to cache quickly when offline
      }
    },
    // Cache all app pages (dashboard, study, etc) except admin
    {
      urlPattern: ({ url }) => {
        const pathname = url.pathname;
        // Cache everything except admin routes
        return pathname === '/' || 
               pathname.startsWith('/study/') || 
               pathname === '/offline-study' ||
               pathname === '/login' ||
               (pathname.startsWith('/') && !pathname.startsWith('/admin') && !pathname.startsWith('/_next') && !pathname.includes('.'));
      },
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'app-pages',
        plugins: [
          {
            cacheWillUpdate: async ({ response }) => {
              if (response && response.status === 200) {
                return response;
              }
              return null;
            }
          }
        ],
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 30 * 24 * 60 * 60 // 30 days
        }
      }
    },
    // Pre-cache critical pages
    {
      urlPattern: ({ url }) => url.pathname === '/',
      handler: 'CacheFirst',
      options: {
        cacheName: 'homepage',
        expiration: {
          maxEntries: 1,
          maxAgeSeconds: 30 * 24 * 60 * 60 // 30 days
        }
      }
    },
    // Handle Supabase API calls for offline functionality
    // Exclude auth endpoints to prevent interference
    {
      urlPattern: ({ url }) => {
        const isSupabase = url.origin.includes('supabase.co');
        const isAuth = url.pathname.includes('/auth/');
        return isSupabase && !isAuth;
      },
      handler: 'NetworkOnly',
      options: {
        backgroundSync: {
          name: 'supabase-sync',
          options: {
            maxRetentionTime: 24 * 60 // Retry for max of 24 hours
          }
        }
      }
    }
  ]
});

const nextConfig = {
  images: {
    domains: ['localhost'],
  },
}

module.exports = withPWA(nextConfig);