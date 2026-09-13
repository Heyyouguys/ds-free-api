// DS Free API Service Worker for PWA
//
// 缓存策略（有意为之，勿改成全站 stale-while-revalidate）：
// - `/admin/api/*` → 直接走网络，不缓存（避免读到过期的配置/统计）
// - 导航请求（HTML）→ network-first + 离线回退，保证发版后能看到新版本
// - 其余静态资源 → stale-while-revalidate（Vite 产物带内容 hash，可安全缓存）
const CACHE_NAME = 'ds-free-api-v2';
const PRECACHE = ['/admin/', '/admin/favicon.svg', '/admin/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // API：网络优先，离线时明确报错，绝不返回缓存中的旧业务数据
  if (url.pathname.startsWith('/admin/api/')) {
    event.respondWith(
      fetch(request).catch(
        () =>
          new Response(JSON.stringify({ error: 'Offline' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          })
      )
    );
    return;
  }

  // 导航请求：network-first，发版后立即生效；离线时回退到缓存的 index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/admin/', copy));
          }
          return response;
        })
        .catch(() =>
          caches
            .match('/admin/')
            .then((cached) => cached || new Response('Offline', { status: 503 }))
        )
    );
    return;
  }

  // 静态资源：stale-while-revalidate
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            networkResponse.type === 'basic'
          ) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
