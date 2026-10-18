/* ============================================================================
 * DEMINVEST — SERVICE WORKER (PWA + WEB PUSH + CONTROLLED CACHE)
 * ============================================================================
 * Regola fondamentale:
 * - Gli asset statici della shell UI vengono serviti con strategia Network-First
 *   con fallback a cache controllata.
 * - Le API di quotazione (/api/market/*) NON vengono MAI spacciate come live da
 *   cache del Service Worker: se offline, viene restituito uno stato esplicito
 *   OFFLINE_CACHE_BLOCKED o marcato con isOfflineCached: true.
 * ============================================================================ */

const CACHE_VERSION = 'deminvest-shell-v1.0.5';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.webmanifest',
  '/Logo_no_sfondo.png',
  '/favicon.png',
  '/favicon.ico',
  '/apple-touch-icon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-192.png',
  '/icons/icon-maskable-512.png',
  '/icons/icon-192-transparent.png',
];

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((oldKey) => caches.delete(oldKey))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  // Non intercettare mai chiamate API per spacciarle come dati live
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Navigazione HTML: Network-first con fallback a index.html / offline.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_VERSION);
        const cachedApp = await cache.match('/index.html');
        if (cachedApp) return cachedApp;
        return cache.match('/offline.html');
      })
    );
    return;
  }

  // Asset statici UI
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200 && url.origin === self.location.origin) {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        return new Response('Offline', { status: 503, statusText: 'Offline' });
      })
  );
});

// Gestione messaggi dalla UI (es. aggiornamento controllato o recovery)
self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data.type === 'CLEAR_CACHE_RECOVERY') {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
    );
  }
});

// Gestione Web Push server-side (VAPID RFC 8292)
self.addEventListener('push', (event) => {
  let payload = {
    title: 'DemInvest — Notifica di Mercato',
    body: 'Nuovo aggiornamento disponibile su DemInvest.',
    url: '/notifications',
    tag: 'deminvest-alert',
    severity: 'INFO',
    timestamp: new Date().toISOString(),
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      payload = { ...payload, ...parsed };
    } catch {
      payload.body = event.data.text();
    }
  }

  const isAndroid = self.navigator && /android/i.test(self.navigator.userAgent);

  const options = {
    body: payload.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192-transparent.png',
    tag: payload.tag || 'deminvest-alert',
    renotify: true,
    requireInteraction: payload.severity === 'HIGH' || payload.severity === 'CRITICAL',
    data: {
      url: payload.url || '/notifications',
      signalId: payload.signalId || null,
      assetId: payload.assetId || null,
      timestamp: payload.timestamp,
    },
    actions: [
      { action: 'open_detail', title: 'Verifica Dettagli' },
      { action: 'dismiss', title: 'Ignora' },
    ],
  };

  event.waitUntil(self.registration.showNotification(payload.title, options));
});

// Apertura del dettaglio dalla notifica push
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const targetUrl = (event.notification.data && event.notification.data.url) || '/notifications';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.postMessage({
            type: 'NOTIFICATION_CLICKED',
            url: targetUrl,
            data: event.notification.data,
          });
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
