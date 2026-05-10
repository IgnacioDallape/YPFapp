// RemitosApp — Service Worker
const CACHE = 'remitosapp-v3';
const STATIC = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/app.js',
  '/manifest.json',
  '/icons/icon.svg',
  '/icons/icon-maskable.svg',
];

// Instalar: cachear assets estáticos
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
  );
});

// Activar: limpiar caches viejos
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: network-first para Supabase, cache-first para estáticos
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Supabase y externos → siempre red
  if (url.hostname.includes('supabase.co') || url.hostname.includes('googleapis.com') || url.hostname.includes('jsdelivr.net')) {
    e.respondWith(fetch(e.request).catch(() => new Response('', { status: 503 })));
    return;
  }

  // Estáticos → cache-first, red como fallback
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res && res.status === 200 && e.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match('/index.html'));
    })
  );
});
