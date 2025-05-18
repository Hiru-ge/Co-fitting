const CACHE_NAME = 'co-fitting-v1';
const urlsToCache = [
  '/',
  '/static/css/common.css',
  '/static/script/common.js',
  '/static/images/square-icon.jpg',
  '/static/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});

// ナビゲーション制御
self.addEventListener('activate', event => {
  event.waitUntil(
    clients.claim()
  );
}); 