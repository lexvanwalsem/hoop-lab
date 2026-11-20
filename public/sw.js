// Offline support. The app shell is cached on install, the large model files the first time they are used.
// Hashed build files never change, so cache-first is safe for everything except the page itself.
const CACHE = 'hoop-lab-v1';
const BIG = /\/(models|wasm)\//;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const page = await fetch('./', { cache: 'reload' });
      const html = await page.clone().text();
      await cache.put('./', page);
      // every script, stylesheet and icon the page mentions, and the fonts its stylesheets mention
      const urls = new Set(['./manifest.webmanifest', './icon.svg']);
      for (const m of html.matchAll(/(?:src|href)="([^"#]+)"/g)) urls.add(m[1]);
      for (const u of [...urls]) {
        if (!u.endsWith('.css')) continue;
        const css = await (await fetch(u)).text();
        for (const f of css.matchAll(/url\(([^)]+)\)/g)) urls.add(new URL(f[1].replace(/["']/g, ''), new URL(u, self.registration.scope)).href);
      }
      await Promise.all([...urls].map((u) => cache.add(u).catch(() => undefined)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      if (req.mode === 'navigate') {
        // the page: network first so updates arrive, the cached copy when offline
        try {
          const fresh = await fetch(req);
          cache.put('./', fresh.clone());
          return fresh;
        } catch {
          return (await cache.match('./')) ?? Response.error();
        }
      }
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      const res = await fetch(req);
      // a ranged or partial response cannot be cached
      if (res.ok && res.status === 200 && (BIG.test(url.pathname) || url.pathname.includes('/assets/'))) cache.put(req, res.clone());
      return res;
    })(),
  );
});
