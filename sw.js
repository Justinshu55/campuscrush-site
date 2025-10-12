// sw.js
const CACHE = 'ccrush-v3';
const CORE = [
  '/',                // start_url
  '/index.html',      // fallback for navigations
  '/manifest.webmanifest',
  '/favicon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(CORE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // enable navigation preload for faster first paint
    if ('navigationPreload' in self.registration) {
      await self.registration.navigationPreload.enable();
    }
    // clean old caches
    const names = await caches.keys();
    await Promise.all(names.filter(n => n !== CACHE).map(n => caches.delete(n)));
  })());
  self.clients.claim();
});

// Network-first for navigations; fall back to cached '/', then '/index.html'
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        // Use preload response if available
        const preload = await event.preloadResponse;
        if (preload) return preload;

        const net = await fetch(event.request);
        // update cache copy asynchronously
        const cache = await caches.open(CACHE);
        cache.put(event.request, net.clone()).catch(()=>{});
        return net;
      } catch (err) {
        // offline fallback
        const cache = await caches.open(CACHE);
        return (await cache.match(event.request)) ||
               (await cache.match('/')) ||
               (await cache.match('/index.html'));
      }
    })());
    return;
  }

  // cache-first for static assets
  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;
    try {
      const net = await fetch(event.request);
      const cache = await caches.open(CACHE);
      cache.put(event.request, net.clone()).catch(()=>{});
      return net;
    } catch (e) {
      return cached || Response.error();
    }
  })());
});
