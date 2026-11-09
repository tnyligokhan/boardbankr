/*
 * BoardBankr service worker. It makes the app installable and quicker to open; it never
 * stores money or game data.
 *
 * - /api and the live connection: always the network, never cached. A stale balance would
 *   be worse than no balance.
 * - /assets/*: built files whose names change with every build, so a stored copy is always
 *   right; served from the cache first.
 * - Icons and the manifest: from the cache, refreshed in the background.
 * - Pages: the network first; the last good copy only when offline, so the app can still
 *   open and say it is offline.
 */
const VERSION = 'bb-v1';
const SHELL = `${VERSION}-shell`;
const ASSETS = `${VERSION}-assets`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(['/app', '/manifest.webmanifest', '/icon.svg', '/icon-192.png']))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname === '/ws') return;

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.open(ASSETS).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      }),
    );
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok && url.pathname === '/app') caches.open(SHELL).then((cache) => cache.put('/app', res.clone()));
          return res;
        })
        .catch(async () => (await caches.match(request)) ?? (await caches.match('/app')) ?? Response.error()),
    );
    return;
  }

  if (/\.(png|svg|ico|webmanifest|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      caches.open(SHELL).then(async (cache) => {
        const hit = await cache.match(request);
        const fresh = fetch(request)
          .then((res) => {
            if (res.ok) cache.put(request, res.clone());
            return res;
          })
          .catch(() => hit);
        return hit ?? fresh;
      }),
    );
  }
});
