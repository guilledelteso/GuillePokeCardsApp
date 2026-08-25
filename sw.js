const CACHE_VERSION = 'guillePokecards-v6';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const API_CACHE    = `${CACHE_VERSION}-api`;
const IMAGE_CACHE  = `${CACHE_VERSION}-images`;

const STATIC_ASSETS = [
  './manifest.json',
  './css/styles.css',
  './js/api.js',
  './js/storage.js',
  './js/app.js',
  './icons/icon.svg',
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(STATIC_ASSETS))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => !k.startsWith(CACHE_VERSION)).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  // HTML — siempre desde la red, nunca desde caché
  if (request.destination === 'document') {
    event.respondWith(
      fetch(request, { cache: 'no-store' }).catch(() => caches.match(request))
    );
    return;
  }

  // API — red primero, caché como fallback offline
  if (url.hostname === 'api.tcgdex.net') {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  // Imágenes — caché permanente
  if (url.hostname === 'assets.tcgdex.net') {
    event.respondWith(cacheFirst(request, IMAGE_CACHE));
    return;
  }

  // CSS / JS / iconos — caché primero
  event.respondWith(cacheFirst(request, STATIC_CACHE));
});

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return caches.match(request) || new Response(JSON.stringify({ error: 'offline' }), {
      status: 503, headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) (await caches.open(cacheName)).put(request, response.clone());
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}
