// Service Worker - VERSION 14 (Design ultra-contrasté + Exercices de rechange)
const CACHE_NAME = 'musculation-v14';
const urlsToCache = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/storage.js',
  '/manifest.json',
  '/icon-192_old.png',
  '/icon-512.png'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache);
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(k => {
        if (k !== CACHE_NAME) {
          return caches.delete(k);
        }
      })
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(res => {
      return res || fetch(event.request).then(r => {
        return caches.open(CACHE_NAME).then(c => { 
          c.put(event.request, r.clone()); 
          return r; 
        });
      });
    })
  );
});
