// Service Worker for Reachableads
const CACHE_NAME = 'reachableads-v5';
const RUNTIME_CACHE = 'reachableads-runtime-v5';

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/icon.png',
  '/logo.png',
  '/manifest.json',
  '/config.js'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting()) // Activate immediately
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => {
            // Delete old caches
            return cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE;
          })
          .map((cacheName) => {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          })
      );
    })
    .then(() => self.clients.claim()) // Take control of all pages
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests (like API calls to api.creative.reachableads.com)
  if (url.origin !== location.origin) {
    return;
  }

  // Skip API requests (they should always go to network)
  // Note: API is on separate domain (api.creative.reachableads.com), so this shouldn't match
  // but keeping it as a safeguard
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Strategy: Cache first, then network
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        // Not in cache, fetch from network
        return fetch(request)
          .then((response) => {
            // Don't cache non-successful responses
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response
            const responseToCache = response.clone();

            // Cache the response
            caches.open(RUNTIME_CACHE)
              .then((cache) => {
                cache.put(request, responseToCache);
              });

            return response;
          })
          .catch(() => {
            // If network fails and it's a navigation request, return offline page
            if (request.mode === 'navigate') {
              return caches.match('/index.html');
            }
          });
      })
  );
});

// Handle push notifications (optional, for future use)
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push notification received');
  // Future implementation
});

// Handle notification clicks (optional, for future use)
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification clicked');
  event.notification.close();
  // Future implementation
});

