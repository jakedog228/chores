const CACHE_NAME = 'chore-calendar-v1';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icon.png'
];
const IS_DEV = ['localhost', '127.0.0.1'].includes(self.location.hostname);

// Install: cache app shell (production only)
self.addEventListener('install', (event) => {
  if (!IS_DEV) {
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.addAll(STATIC_ASSETS);
      })
    );
  }
  self.skipWaiting();
});

// Activate: clean old caches, claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch: skip caching in dev, cache-first for static assets in production
self.addEventListener('fetch', (event) => {
  if (IS_DEV) return;

  const url = new URL(event.request.url);

  // Don't cache API requests
  if (url.pathname.startsWith('/api')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      }).catch(() => cached);

      return cached || networkFetch;
    })
  );
});

// Push notifications
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'Chore Calendar', {
      body: data.body || '',
      icon: '/icon.png',
      badge: '/icon.png'
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      return clients.openWindow('/');
    })
  );
});
