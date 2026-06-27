// Service worker: caches the app shell so it opens offline.
// Expense data itself lives in localStorage, not here.
var CACHE = 'won-spent-v1';
var ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) { return cache.addAll(ASSETS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);
  // Never cache the exchange-rate API — always go to network, fall back gracefully.
  if (url.hostname.indexOf('er-api.com') !== -1) return;

  // App shell: cache-first, fall back to network, then cache.
  event.respondWith(
    caches.match(req).then(function (cached) {
      if (cached) return cached;
      return fetch(req).then(function (res) {
        if (res && res.status === 200 && url.origin === self.location.origin) {
          var clone = res.clone();
          caches.open(CACHE).then(function (cache) { cache.put(req, clone); });
        }
        return res;
      }).catch(function () { return caches.match('./index.html'); });
    })
  );
});
