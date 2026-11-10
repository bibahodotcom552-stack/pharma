// Offline app shell. BUMP VERSION whenever any app file changes, or phones keep the old copy.
const VERSION = 'v7';
const FILES = ['./','index.html','css/style.css','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png',
  ...['template','state','settings','grid','keep','photos','prompt','gemini','audit','results','app'].map(f=>`js/${f}.js`)];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  if (new URL(e.request.url).origin !== location.origin) return; // never cache Gemini calls
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
