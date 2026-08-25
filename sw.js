const CACHE_VERSION = 'guillePokecards-v3';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const API_CACHE = `${CACHE_VERSION}-api`;
const IMAGE_CACHE = `${CACHE_VERSION}-images`;

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/api.js',
  './js/storage.js',
  './js/app.js',
  './icons/icon.svg',
];

// Install: cache static assets
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(STATIC_ASSETS))
  );
});

// Activate: clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k.startsWith('pokemon-tcg-') && !k.startsWith(CACHE_VERSION))
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch strategy:
// - Static assets: cache-first
// - API calls: network-first with cache fallback (30min TTL)
// - Images: cache-first with network fallback
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests
  if (request.method !== 'GET') return;

  // TCGDex API calls - network first
  if (url.hostname === 'api.tcgdex.net') {
    event.respondWith(networkFirstWithTTL(request, API_CACHE, 30 * 60 * 1000));
    return;
  }

  // TCGDex images - cache first (images rarely change)
  if (url.hostname === 'assets.tcgdex.net') {
    event.respondWith(cacheFirstWithFallback(request, IMAGE_CACHE));
    return;
  }

  // Static assets - cache first
  event.respondWith(cacheFirstWithFallback(request, STATIC_CACHE));
});

async function networkFirstWithTTL(request, cacheName, ttl) {
  const cache = await caches.open(cacheName);
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const responseToCache = networkResponse.clone();
      // Store with timestamp
      const headers = new Headers(responseToCache.headers);
      headers.set('sw-cached-at', Date.now().toString());
      const cachedResponse = new Response(await responseToCache.blob(), {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers,
      });
      cache.put(request, cachedResponse);
    }
    return networkResponse;
  } catch {
    // Network failed, try cache
    const cached = await cache.match(request);
    if (cached) {
      const cachedAt = parseInt(cached.headers.get('sw-cached-at') || '0');
      if (Date.now() - cachedAt < ttl) return cached;
    }
    if (cached) return cached; // Return stale if nothing else
    return new Response(JSON.stringify({ error: 'offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function cacheFirstWithFallback(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    return new Response('Offline - recurso no disponible', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}
