// build.py が VERSION を書き換える。値が変わると iPhone 側で新しい版に入れ替わる
const VERSION = 'dca736089bcf';
const CACHE = 'tools-' + VERSION;
const SHELL = ['./', 'index.html', 'manifest.json', 'tools.json', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })));
    // tools.json に載っているツールをすべて先に保存しておく（オフライン用）
    const list = await (await cache.match('tools.json')).json();
    await cache.addAll(list.tools.map(t => new Request(encodeURIComponent(t.file), { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Google Fonts などの外部リソース：取れたら保存、オフライン時は保存分を使う
  if (url.origin !== location.origin) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await fetch(req);
        cache.put(req, res.clone());
        return res;
      } catch {
        return (await cache.match(req)) || Response.error();
      }
    })());
    return;
  }

  // 同じサイト内：保存分を優先（版の更新は VERSION の変更で行う）
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch {
      return (await cache.match('index.html')) || Response.error();
    }
  })());
});
