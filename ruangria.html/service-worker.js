const CACHE_NAME = 'ruangria-shell-v5';
const CORE = ['./', './index.html', './manifest.json', './icons/icon.svg', './music-config.js', './ar-camera.js', './ar-camera.css', './tampak.js', './tampak.css'];
const OPTIONAL = ['./icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './style.css', './script.js'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then(async (cache) => {
    await cache.addAll(CORE);
    await Promise.all(OPTIONAL.map((url) => cache.add(url).catch(() => undefined)));
  }).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('ruangria-shell-') && key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then((response) => {
      if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', response.clone()));
      return response;
    }).catch(() => caches.match('./index.html')));
    return;
  }
  if (new URL(request.url).pathname.endsWith('/music-config.js') || new URL(request.url).pathname.includes('/assets/sounds/')) {
    event.respondWith(fetch(request).then((response) => {
      if (response.status === 200) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone())).catch(() => undefined);
      return response;
    }).catch(async () => (await caches.match(request)) || new Response('', { status: 503 })));
    return;
  }
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
    if (response.status === 200) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone())).catch(() => undefined);
    return response;
  })));
});