const CACHE_VERSION = 'guillePokecards-v5';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const API_CACHE    = `${CACHE_VERSION}-api`;
const IMAGE_CACHE  = `${CACHE_VERSION}-images`;

// HTML nunca se cachea — siempre se pide a la red
const STATIC_ASSETS = [
  './manifest.json',
  './css/styles.css',
  './js/api.js',
  './js/storage.js',
  './js/app.js',
  './icons/icon.svg',
];

// Install: precachear assets (sin HTML) y activar de inmediato
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(STATIC_ASSETS))
  );
});

// Activate: limpiar TODOS los cachés anteriores, tomar control y avisar a las páginas
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => !k.startsWith(CACHE_VERSION))
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ includeUncontrolled: true, type: 'window' }))
      .then(clients => clients.forEach(client => client.postMessage({ type: 'SW_UPDATED' })))
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  // HTML — siempre red, nunca caché
  if (request.destination === 'document') {
    event.respondWith(networkOnlyHTML(request));
    return;
  }

  // API TCGDex — red primero, caché 30 min como fallback
  if (url.hostname === 'api.tcgdex.net') {
    event.respondWith(networkFirstWithTTL(request, API_CACHE, 30 * 60 * 1000));
    return;
  }

  // Imágenes TCGDex — caché permanente
  if (url.hostname === 'assets.tcgdex.net') {
    event.respondWith(cacheFirstWithFallback(request, IMAGE_CACHE));
    return;
  }

  // CSS / JS / iconos — caché primero, red como fallback
  event.respondWith(cacheFirstWithFallback(request, STATIC_CACHE));
});

async function networkOnlyHTML(request) {
  try {
    return await fetch(request, { cache: 'no-store' });
  } catch {
    const cached = await caches.match('./index.html') || await caches.match(request);
    return cached || new Response('<h1>Sin conexión</h1>', {
      headers: { 'Content-Type': 'text/html' }
    });
  }
}

async function networkFirstWithTTL(request, cacheName, ttl) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) {
      const headers = new Headers(response.headers);
      headers.set('sw-cached-at', Date.now().toString());
      const toStore = new Response(await response.clone().blob(), {
        status: response.status, statusText: response.statusText, headers,
      });
      cache.put(request, toStore);
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) {
      const age = Date.now() - parseInt(cached.headers.get('sw-cached-at') || '0');
      if (age < ttl) return cached;
    }
    return cached || new Response(JSON.stringify({ error: 'offline' }), {
      status: 503, headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function cacheFirstWithFallback(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}
