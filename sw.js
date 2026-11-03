/* Tuk Manager. O âmbito acompanha a pasta da app (GitHub Pages: /tuk-manager/). */
const CACHE = 'tuk-manager-v7';
const SHELL = [
  './',
  './index.html',
  './privacy.html',
  './terms.html',
  './config.js',
  './manifest.webmanifest',
  './css/base.css',
  './css/extra.css',
  './css/app.css',
  './js/app.js',
  './js/view.js',
  './js/store.js',
  './js/model.js',
  './js/demo.js',
  './js/format.js',
  './js/google.js',
  './js/sheet.js',
  './js/remote.js',
  './vendor/chart.umd.min.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/favicon-32.png',
  './icons/apple-touch-icon.png',
  './icons/icon-any.svg',
  './icons/icon-maskable.svg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((k) => k.startsWith('tuk-manager') && k !== CACHE).map((k) => caches.delete(k))
  )).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match(e.request).then((r) => r || (e.request.mode === 'navigate' ? caches.match('./index.html') : new Response('', { status: 504 }))))
  );
});
