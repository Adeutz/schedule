// Network first, so the newest schedule always shows; the last copy when offline
const CACHE = 'schedule-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== location.origin) return;
  url.search = '';                      // data.json?t=… is kept as data.json
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(request);
      if (response.ok) await cache.put(url.href, response.clone());
      return response;
    } catch (error) {
      const copy = await cache.match(url.href);
      if (copy) return copy;
      throw error;
    }
  })());
});
